import { Injectable } from '@nestjs/common';
import { subDays } from 'date-fns';
import { InviteStatus } from 'src/domain/entity/mail-history-status.entity';
import { InviteStatusEnum } from 'src/domain/enum/mail-history-status.enum';
import { IMailSeedData } from 'src/domain/interface/mail-history-data.interface';
import { UserSeedDataInterface } from 'src/domain/interface/user-seed-data.interface';
import { UserSeedDataService } from '../user/user-seed-data.service';

@Injectable()
export class MailHistorySeedDataService {
  constructor(private userSeedDataService: UserSeedDataService) { }

  async getData(): Promise<IMailSeedData[]> {
    const mailSeedData: IMailSeedData[] = (
      await this.userSeedDataService.getData()
    ).map(
      (i: UserSeedDataInterface) =>
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
      if (
        [
          'sent.user@example.com',
          'used.user@example.com',
          'registered.user@example.com',
        ].includes(mail.email as string)
      ) {
        mail[i] = {
          ...mail,
          sentAt: subDays(new Date(), 31),
        } as IMailSeedData;
      }
    }
    return mailSeedData;
  }
}
