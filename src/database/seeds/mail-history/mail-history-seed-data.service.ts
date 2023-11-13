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
    ];
  }
}
