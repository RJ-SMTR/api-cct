import { Logger } from '@nestjs/common';
import { SftpClientService } from 'nest-sftp';
import { ConnectConfig } from 'ssh2';

export class SftpService {
    private readonly logger: Logger;
    constructor(private readonly sftpClient: SftpClientService) {
        this.logger = new Logger();
    }

    async download(
        remotePath: string,
        localPath: string,
    ): Promise<string | NodeJS.ReadableStream | Buffer> {
        return await this.sftpClient.download(remotePath, localPath) as unknown as Promise<string | NodeJS.ReadableStream | Buffer>;
    }
    
    // change connection to a different user/password prior to upload
    async submit(
        remotePath: string,
        localPath: string,
        submitConfig: ConnectConfig,
    ): Promise<string | NodeJS.ReadableStream | Buffer> {
        await this.sftpClient.resetConnection(submitConfig);
        return await this.sftpClient.upload(remotePath, localPath);
    }
}