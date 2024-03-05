import { Logger } from '@nestjs/common';
import { SftpClientService } from 'nest-sftp';
import { ConnectConfig } from 'ssh2';

export class SftpService {
  private readonly logger: Logger;
  constructor(private readonly sftpClient: SftpClientService) {
    this.logger = new Logger();
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
}
