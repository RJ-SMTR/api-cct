import { DynamicModule, Module } from '@nestjs/common';
import * as SftpClient from 'ssh2-sftp-client';
import { SftpClientService } from './sftp-client/sftp-client.service';

import { ConnectConfig } from './interfaces/connect-config.interface';
import { SftpService } from './sftp.service';

@Module({
  providers: [SftpClientService, SftpService],
  exports: [SftpClientService, SftpService],
})
export class SftpModule {
  static forRoot(
    config: ConnectConfig,
    delayConnection = false,
  ): DynamicModule {
    return {
      module: SftpModule,
      providers: [
        SftpClientService,
        {
          provide: SftpClient,
          useFactory: async () => {
            const client = new SftpClient();
            if (!delayConnection) {
              await client.connect(config);
            }
            return client;
          },
        },
      ],
      exports: [SftpClientService, SftpService],
    };
  }
}
