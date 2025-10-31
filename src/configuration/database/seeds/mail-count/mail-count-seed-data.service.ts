import { MailCountDataInterface } from 'src/domain/interface/mail-count-data.interface';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/configuration/config.type';

@Injectable()
export class MailCountSeedDataService {
  constructor(private configService: ConfigService<AllConfigType>) { }

  getData(): MailCountDataInterface[] {
    return [
      {
        email: this.configService.getOrThrow('mail.defaultEmail', {
          infer: true,
        }),
        maxRecipients: 500,
      },
    ];
  }
}
