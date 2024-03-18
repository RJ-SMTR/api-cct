import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { format } from 'date-fns';
import { AllConfigType } from 'src/config/config.type';
import { getBRTFromUTC } from 'src/utils/date-utils';
import { logDebug } from 'src/utils/log-utils';
import { ConnectConfig } from './interfaces/connect-config.interface';
import { SftpClientService } from './sftp-client/sftp-client.service';
import { SftpBackupFolder } from './enums/sftp-backup-folder.enum';

@Injectable()
export class SftpService {
  private readonly logger: Logger;
  private readonly REMESSA_FOLDER = '/remessa';
  private readonly RETORNO_FOLDER = '/retorno';
  private readonly BACKUP_FOLDER = '/backup';
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly sftpClient: SftpClientService,
  ) {
    this.logger = new Logger('SftpService', { timestamp: true });
  }

  private getClientCredentials(): ConnectConfig {
    return {
      host: this.configService.getOrThrow('sftp.host', { infer: true }),
      port: this.configService.getOrThrow('sftp.port', { infer: true }),
      username: this.configService.getOrThrow('sftp.username', { infer: true }),
      password: this.configService.getOrThrow('sftp.password', { infer: true }),
    }
  }

  /**
   * Reset connection with default NestJS SFTP settings
   */
  private async connectClient() {
    await this.sftpClient.resetConnection(this.getClientCredentials());
  }

  public async download(
    remotePath: string,
    localPath: string,
  ): Promise<string | NodeJS.ReadableStream | Buffer> {
    return await this.sftpClient.download(remotePath, localPath) as unknown as Promise<string | NodeJS.ReadableStream | Buffer>;
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
  public async submit(
    remotePath: string,
    localPath: string,
  ): Promise<string | NodeJS.ReadableStream | Buffer> {
    return await this.sftpClient.upload(remotePath, localPath);
  }

  async submitFromString(content: string, remotePath: string) {
    const METHOD = 'submitFromString()';
    await this.connectClient();
    await this.sftpClient.upload(Buffer.from(content, 'utf-8'), remotePath);
    logDebug(this.logger, `Arquivo carregado em ${remotePath}`, METHOD);
  }

  async submitCnabRemessa(content: string) {
    const METHOD = 'submitFromString()';
    await this.connectClient();
    const remotePath = `${this.REMESSA_FOLDER}/${this.getRemessaName()}`;
    await this.sftpClient.upload(Buffer.from(content, 'utf-8'), remotePath);
    logDebug(this.logger, `Arquivo CNAB carregado em ${remotePath}`, METHOD);
  }

  /**
   * @example 'smtr_prefeiturarj_31122024_235959.txt'
   */
  private getRemessaName() {
    const now = getBRTFromUTC(new Date());
    const stringDate = format(now, `ddMMyy_HHmmss`);
    return `smtr_prefeiturarj_${stringDate}.txt`;
  }

  /**
   * Get first Cnab in Retorno and read it
   * 
   * @returns CnabName: file name with extension (no folder)
   */
  public async getFirstCnabRetorno(): Promise<{
    cnabName: string | null,
    cnabString: string | null,
  }> {
    await this.connectClient();
    const firstFile = (await this.sftpClient.list(
      this.RETORNO_FOLDER,
      this.getRegexForCnab('retorno'),
    )).pop();

    if (!firstFile) {
      return { cnabName: null, cnabString: null };
    }

    const cnabPath = `${this.RETORNO_FOLDER}/${firstFile.name}`;
    const cnabString =
      await this.downloadToString(cnabPath);
    return { cnabName: firstFile.name, cnabString };
  }

  /**
   * Move CNAB Retorno to backup folder
   * 
   * @param cnabName Name with extension. No folder path.
   */
  public async backupCnabRetorno(cnabName: string, folder: SftpBackupFolder) {
    const METHOD = 'backupCnabRetorno()';
    const originPath = `${this.RETORNO_FOLDER}/${cnabName}`;
    const destPath = `${this.BACKUP_FOLDER}/${folder}/${cnabName}`;
    await this.connectClient();
    await this.sftpClient.rename(originPath, destPath);
    logDebug(this.logger, `Arquivo CNAB movido de '${originPath}' para ${destPath}`, METHOD);
  }

  public getRegexForCnab(fileType: 'remessa' | 'retorno'): RegExp {
    const fileTypeStr = fileType === 'remessa' ? 'rem' : 'ret';
    const regexString = `smtr_prefeiturarj_\\d{6}_\\d{6}\\.${fileTypeStr}`;
    const regex = new RegExp(regexString);
    return regex;
  }
}
