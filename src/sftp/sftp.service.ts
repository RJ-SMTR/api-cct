import { Injectable, Logger } from '@nestjs/common';
import { SftpClientService } from './sftp-client/sftp-client.service';
import { ConnectConfig } from './interfaces/connect-config.interface';
import { FileInfo } from './interfaces/file-info.interface';

@Injectable()
export class SftpService {
  private readonly logger: Logger;
  private readonly REMESSA_FOLDER = '/remessa'
  private readonly RETORNO_FOLDER = '/retorno'
  private readonly BACKUP_REMESSA = '/backup/remessa'
  private readonly BACKUP_RETORNO_FOLDER = '/backup/retorno'
  constructor(private readonly sftpClient: SftpClientService) {
    this.logger = new Logger('SftpService', { timestamp: true });
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
      this.logger.error(`Error downloading file from SFTP: ${error.message}`);
      throw error;
    }
  }

  /**
   * Change connection to a different user/password prior to upload
   */
  public async submit(
    remotePath: string,
    localPath: string,
    submitConfig: ConnectConfig,
  ): Promise<string | NodeJS.ReadableStream | Buffer> {
    await this.sftpClient.resetConnection(submitConfig);
    return await this.sftpClient.upload(remotePath, localPath);
  }

  async submitFromString(content: string, remotePath: string) {
    await this.sftpClient.upload(Buffer.from(content, 'utf-8'), remotePath);
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
    const fileInfo: FileInfo = await this.sftpClient.list(
      this.RETORNO_FOLDER,
      this.getRegexForCnab('retorno'),
    )[0];
    const cnabPath = `${this.RETORNO_FOLDER}/${fileInfo.name}`;
    const cnabString =
      await this.downloadToString(cnabPath);
    return { cnabName: fileInfo.name, cnabString };
  }

  /**
   * Move CNAB Retorno to backup folder
   * 
   * @param cnabName Name with extension. No folder path.
   */
  public async backupCnabRetorno(cnabName: string) {
    await this.sftpClient.rename(
      `${this.RETORNO_FOLDER}/${cnabName}`,
      `${this.BACKUP_RETORNO_FOLDER}/${cnabName}`
    );
  }

  public getRegexForCnab(
    fileType: 'remessa' | 'retorno',
    startDate?: Date,
    filter?: {
      year?: boolean,
      month?: boolean,
      day?: boolean,
      hour?: boolean,
      min?: boolean,
      sec?: boolean,
    },
  ): RegExp {
    const fileTypeStr =
      fileType === 'remessa' ? 'rem' : 'ret';
    const year = startDate && filter?.year ? startDate.getFullYear() : '\\d{4}';
    const month = startDate && filter?.month ? String(startDate.getMonth() + 1).padStart(2, '0') : '\\d{2}';
    const day = startDate && filter?.day ? String(startDate.getDate()).padStart(2, '0') : '\\d{2}';
    const hour = startDate && filter?.hour ? String(startDate.getHours()).padStart(2, '0') : '\\d{2}';
    const minute = startDate && filter?.min ? String(startDate.getMinutes()).padStart(2, '0') : '\\d{2}';
    const second = startDate && filter?.sec ? String(startDate.getSeconds()).padStart(2, '0') : '\\d{2}';
    const regexString =
      `smtrrj_${year}_${month}_${day}_${hour}_${minute}_${second}_${fileTypeStr}\\.txt`;
    const regex = new RegExp(regexString);
    return regex;
  }
}
