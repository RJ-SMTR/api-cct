import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { format } from 'date-fns';
import { AllConfigType } from 'src/config/config.type';
import { formatDateISODateSlash, getBRTFromUTC, getDateFromCnabName } from 'src/utils/date-utils';
import { OnModuleLoad } from 'src/utils/interfaces/on-load.interface';
import { SftpBackupFolder } from './enums/sftp-backup-folder.enum';
import { ConnectConfig } from './interfaces/connect-config.interface';
import { SftpClientService } from './sftp-client/sftp-client.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { SettingsService } from 'src/settings/settings.service';
import { appSettings } from 'src/settings/app.settings';

@Injectable()
export class SftpService implements OnModuleInit, OnModuleLoad {
  private readonly logger: Logger;
  private rootFolder = '';
  public readonly FOLDERS = {
    REMESSA: '/remessa',
    RETORNO: '/retorno',
    AJUSTES: '/backup/retorno/ajuste_depois',
    BACKUP: '/backup',
    BACKUP_REMESSA: '/backup/remessa',
    BACKUP_RETORNO_FAILURE: '/backup/retorno/failure',
    BACKUP_RETORNO_SUCCESS: '/backup/retorno/success',
  };
  private RECURSIVE_MKDIR: string[] = ['/remessa', '/retorno', '/backup/remessa', '/backup/retorno/failure', '/backup/retorno/success'];
  private readonly REGEX = {
    /** smtr_prefeiturarj_ddMMyy_hhmmss.rem */
    REMESSA: new RegExp(`smtr_prefeiturarj_\\d{6}_\\d{6}\\.rem`),
    /** smtr_prefeiturarj_ddMMyyyy_hhmmss.ret */
    RETORNO: new RegExp(`smtr_prefeiturarj_\\d{8}_\\d{6}\\.ret`),
    /** smtr_prefeiturarj_eerdiario_ddMMyyyy_hhmmss.ext */
    EXTRATO: new RegExp(`smtr_prefeiturarj_eediario_\\d{8}_\\d{6}\\.ext`),
  };

  constructor(private readonly configService: ConfigService<AllConfigType>, private readonly sftpClient: SftpClientService, private readonly settingsService: SettingsService) {
    this.logger = new CustomLogger(SftpService.name, { timestamp: true });
  }

  onModuleInit() {
    this.onModuleLoad().catch((error: Error) => {
      throw error;
    });
  }

  async onModuleLoad() {
    const apiEnv = await this.settingsService.getOneBySettingData(appSettings.any__api_env);
    if (apiEnv.getValueAsString() === 'staging') {
      this.rootFolder = '/backup/stag';
    } else if (apiEnv.getValueAsString() === 'local') {
      this.rootFolder = await this.configService.getOrThrow('sftp.rootFolder', { infer: true });
    }
    await this.createMainFolders();
  }

  /**
   * Return rootFolder + path
   */
  private dir(folder: string): string {
    return this.rootFolder + folder;
  }

  /**
   * Ensure all SFTP subfolders exists.
   */
  public async createMainFolders() {
    const METHOD = this.createMainFolders.name;
    try {
      await this.connectClient();
      for (const folder of this.RECURSIVE_MKDIR) {
        await this.sftpClient.makeDirectory(this.dir(folder), true);
      }
      this.logger.log('As pastas SFTP estão preparadas.', METHOD);
    } catch (error) {
      this.logger.warn(`Falha ao preparar pastas SFTP. - ${error}`, error.stack, METHOD);
    }
  }

  private getClientCredentials(): ConnectConfig {
    return {
      host: this.configService.getOrThrow('sftp.host', { infer: true }),
      port: this.configService.getOrThrow('sftp.port', { infer: true }),
      username: this.configService.getOrThrow('sftp.username', { infer: true }),
      password: this.configService.getOrThrow('sftp.password', { infer: true }),
    };
  }

  /**
   * Reset connection with default NestJS SFTP settings
   */
  private async connectClient() {
    await this.sftpClient.resetConnection(this.getClientCredentials());
  }

  public async download(remotePath: string, localPath: string): Promise<string | NodeJS.ReadableStream | Buffer> {
    return (await this.sftpClient.download(remotePath, localPath)) as unknown as Promise<string | NodeJS.ReadableStream | Buffer>;
  }

  public async downloadToString(remotePath: string): Promise<string> {
    try {
      const buffer = await this.sftpClient.download(remotePath);
      const content = buffer.toString('utf-8');
      return content;
    } catch (error) {
      this.logger.error(`Erro ao baixar do SFTP: ${error.message}`);
      throw error;
    }
  }

  /**
   * Change connection to a different user/password prior to upload
   */
  public async submit(remotePath: string, localPath: string): Promise<string | NodeJS.ReadableStream | Buffer> {
    return await this.sftpClient.upload(this.dir(remotePath), this.dir(localPath));
  }

  async submitFromString(content: string, remotePath: string) {
    const METHOD = 'submitFromString()';
    await this.connectClient();
    const _remotePath = this.dir(remotePath);
    await this.sftpClient.upload(Buffer.from(content, 'utf-8'), _remotePath);
    this.logger.log(`Arquivo carregado em ${_remotePath}`, METHOD);
  }


  public async submitCnabRemessa(content: string, headerName?: string): Promise<string> {
    const METHOD = 'submitCnabRemessa';
    const MAX_RETRIES = 5;
    let attempt = 0;
    let remotePath = '';
    try {
      while (attempt < MAX_RETRIES) {
        try {
          await this.connectClient();
          break;
        } catch (err) {
          attempt++;
          this.logger.warn(`Tentativa ${attempt} de conexão falhou`, METHOD);
          if (attempt >= MAX_RETRIES) {
            throw new Error(`Falha ao conectar após ${MAX_RETRIES} tentativas: ${err}`);
          }
          await new Promise(res => setTimeout(res, 1000));
        }
      }
      
      const remessaName = this.generateRemessaName();
      remotePath =
        headerName === 'VLT'
          ? this.dir(`${this.FOLDERS.REMESSA}/${remessaName}`)
          : this.dir(`${this.FOLDERS.BACKUP_REMESSA}/${remessaName}`);

      await this.sftpClient.upload(Buffer.from(content, 'utf-8'), remotePath);
      await this.submitCnabBackupRemessa(content);

      this.logger.log(`Arquivo CNAB carregado em ${remotePath}`, METHOD);     

    } catch (error) {     
      this.logger.error(`Erro em ${METHOD}: ${error.message}`, METHOD);   
    }finally{
      return remotePath;
    }    
  }


  public async submitCnabBackupRemessa(content: string) {
    const bkpPath = this.dir(`${this.FOLDERS.BACKUP_REMESSA}/${this.getCnabDateFolder(this.generateRemessaName())}`);
    await this.sftpClient.upload(Buffer.from(content, 'utf-8'), bkpPath);
  }

  /**
   * @example 'smtr_prefeiturarj_31122024_235959.rem'
   */
  private generateRemessaName() {
    const now = getBRTFromUTC(new Date());
    const stringDate = format(now, `ddMMyy_HHmmss`);
    return `smtr_prefeiturarj_${stringDate}.rem`;
  }

  /**
   * Get first Cnab in Retorno and read it
   *
   * @param folder For testing you can set custom folder
   *
   * @returns CnabName: file name with extension (no folder)
   */
  public async getFirstRetornoPagamento(folder = this.FOLDERS.RETORNO): Promise<{
    name: string;
    content: string;
  } | null> {
    const METHOD = 'submitCnabRemessa';
    const MAX_RETRIES = 5;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        await this.connectClient();
        break;
      } catch (err) {
        attempt++;
        this.logger.warn(`Tentativa ${attempt} de conexão falhou`, METHOD);
        if (attempt >= MAX_RETRIES) {
          throw new Error(`Falha ao conectar após ${MAX_RETRIES} tentativas: ${err}`);
        }
        await new Promise(res => setTimeout(res, 1000));
      }
    }

    const firstFile = (await this.sftpClient.list(this.dir(folder), this.REGEX.RETORNO)).pop();
    if (!firstFile) {
      return null;
    }

    const cnabPath = this.dir(`${folder}/${firstFile.name}`);
    const cnabString = await this.downloadToString(cnabPath);
    return { name: firstFile.name, content: cnabString };
  }

  /**
   * Get first Cnab Extrato (eediario) in Retorno and read it
   *
   * @returns CnabName: file name with extension (no folder)
   */
  public async getFirstRetornoExtrato(folder = this.FOLDERS.RETORNO): Promise<{
    name: string;
    content: string;
  } | null> {
    await this.connectClient();
    const firstFile = (await this.sftpClient.list(this.dir(folder), this.REGEX.EXTRATO)).pop();

    if (!firstFile) {
      return null;
    }

    const cnabPath = this.dir(`${this.FOLDERS.RETORNO}/${firstFile.name}`);
    const cnabString = await this.downloadToString(cnabPath);
    return { name: firstFile.name, content: cnabString };
  }

  /**
   * Move CNAB Retorno to backup folder
   *
   * @param cnabName Name with extension. No folder path.
   */
  public async moveToBackup(cnabName: string, folder: SftpBackupFolder, cnabContentIfNoOrigin?: string, originFolder = this.FOLDERS.RETORNO) {
    const METHOD = 'moveToBackup';
    const originPath = this.dir(`${originFolder}/${cnabName}`);
    const destPath = this.dir(`${folder}/${this.getCnabDateFolder(cnabName)}`);
    await this.connectClient();
    if (cnabContentIfNoOrigin && !(await this.sftpClient.exists(originPath))) {
      this.logger.log(`Origem não existe: '${originPath}'. Salvando cnab no backup.`);
      await this.sftpClient.upload(Buffer.from(cnabContentIfNoOrigin, 'utf-8'), destPath);
    } else {
      await this.sftpClient.rename(originPath, destPath);
    }
    this.logger.debug(`Arquivo CNAB movido de '${originPath}' para ${destPath}`, METHOD);
  }

  /** Return `yyyy/mm/cnabName` */
  public getCnabDateFolder(cnabName: string) {
    const date = getDateFromCnabName(cnabName);
    const dateString = formatDateISODateSlash(date).split('/').slice(0, -1).join('/');
    return `${dateString}/${cnabName}`;
  }
}
