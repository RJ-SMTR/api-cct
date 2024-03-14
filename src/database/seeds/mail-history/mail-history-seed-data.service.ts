import { Injectable } from '@nestjs/common';
import { subDays } from 'date-fns';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { IMailSeedData } from 'src/mail-history/interfaces/mail-history-data.interface';
import { UserDataInterface } from 'src/users/interfaces/user-data.interface';
import { UserSeedDataService } from '../user/user-seed-data.service';

@Injectable()
export class MailHistorySeedDataService {
  constructor(private userSeedDataService: UserSeedDataService) {}

  getDataFromConfig(): IMailSeedData[] {
    const mailSeedData: IMailSeedData[] = this.userSeedDataService
      .getDataFromConfig()
      .map(
        (i: UserDataInterface) =>
          ({
            user: {
              ...(i.id ? { id: i.id } : {}),
              ...(i.email ? { email: i.email } : {}),
            },
            inviteStatus: new InviteStatus(InviteStatusEnum.used),
          } as IMailSeedData),
      );
    for (let i = 0; i < mailSeedData.length; i++) {
      const mail = mailSeedData[i];
      if (mail.email === 'registered.user@example.com') {
        mail[i] = {
          ...mail,
          sentAt: subDays(new Date(), 31),
        } as IMailSeedData;
      }
    }
    return mailSeedData;
  }
}
