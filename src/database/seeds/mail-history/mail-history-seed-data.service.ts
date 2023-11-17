import { Injectable } from '@nestjs/common';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { IMailSeedData } from 'src/mail-history/interfaces/mail-history-data.interface';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class MailHistorySeedDataService {
  getDataFromConfig(): IMailSeedData[] {
    return [
      {
        user: { id: 2, email: 'henrique@example.com' } as User,
        inviteStatus: { id: InviteStatusEnum.used } as InviteStatus,
      },
      {
        user: { id: 3, email: 'marcia@example.com' } as User,
        inviteStatus: { id: InviteStatusEnum.used } as InviteStatus,
      },
      {
        user: { email: 'jessicasimas.smtr@gmail.com ' } as User,
        email: 'jessicasimas.smtr@gmail.com ',
        inviteStatus: { id: InviteStatusEnum.used } as InviteStatus,
      },
      {
        user: { email: 'leandro.smtr@gmail.com' } as User,
        email: 'leandro.smtr@gmail.com',
        inviteStatus: { id: InviteStatusEnum.used } as InviteStatus,
      },
      {
        user: { email: 'cms.smtr@gmail.com' } as User,
        email: 'cms.smtr@gmail.com',
        inviteStatus: { id: InviteStatusEnum.used } as InviteStatus,
      },
      {
        user: { email: 'carolkingma2013@gmail.com' } as User,
        email: 'carolkingma2013 @gmail.com',
        inviteStatus: { id: InviteStatusEnum.used } as InviteStatus,
      },
      {
        user: { email: 'laurosilvestre.smtr@gmail.com' } as User,
        email: 'laurosilvestre.smtr@gmail.com',
        inviteStatus: { id: InviteStatusEnum.used } as InviteStatus,
      },
    ];
  }
}
