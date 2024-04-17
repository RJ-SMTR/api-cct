import { Injectable, Logger } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { IMailSeedData } from 'src/mail-history/interfaces/mail-history-data.interface';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { MailHistorySeedDataService } from './mail-history-seed-data.service';
import { UserSeedDataService } from '../user/user-seed-data.service';
import { logLog, logWarn } from 'src/utils/log-utils';

@Injectable()
export class MailHistorySeedService {
  private logger = new Logger('MailHistorySeedService', { timestamp: true });
  private newMails: any[] = [];

  constructor(
    @InjectRepository(MailHistory)
    private mailHistoryRepository: Repository<MailHistory>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private mhSeedDataService: MailHistorySeedDataService,
    private userSeedDataService: UserSeedDataService,
  ) { }

  async validateRun() {
    return global.force || (await this.usersRepository.count()) === 0;
  }

  async run() {
    for (const mailFixture of await this.mhSeedDataService.getData()) {
      const itemUser = await this.getHistoryUser(mailFixture);
      const itemSeedUser = (
        await this.userSeedDataService.getData()
      ).find((i) => i.email === itemUser.email);
      const foundMail = await this.mailHistoryRepository.findOne({
        where: {
          user: { email: itemUser.email as string },
        },
      });
      const hash = await this.generateInviteHash();
      const newItem = { ...mailFixture };
      newItem.user = itemUser;
      newItem.email = itemUser.email as string;
      newItem.hash = hash;
      if (itemSeedUser?.inviteStatus) {
        newItem.inviteStatus = itemSeedUser.inviteStatus;
      }
      await this.saveMailHistory(newItem, itemUser, foundMail);
      this.pushNewMail(newItem, foundMail);
    }

    if (this.newMails.length) {
      this.printResults();
    } else {
      logLog(this.logger, 'No new mails changed.');
    }
  }

  pushNewMail(mail: IMailSeedData, foundMail: MailHistory | null) {
    this.newMails.push({
      status: foundMail ? 'updated' : 'created',
      email: mail.email,
      hash: mail.hash,
      inviteStatus: mail.inviteStatus,
      sentAt: mail.sentAt,
    });
  }

  async saveMailHistory(
    mail: IMailSeedData,
    itemUser: User,
    foundMail: MailHistory | null,
  ) {
    await this.mailHistoryRepository.save(
      this.mailHistoryRepository.create({
        ...mail,
        id: foundMail?.id || mail.id,
      }),
    );
    await this.usersRepository.save(
      this.usersRepository.create({
        id: itemUser.id,
        hash: mail.hash,
      }),
    );
  }

  async generateInviteHash(): Promise<string> {
    let hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');
    while (await this.mailHistoryRepository.findOne({ where: { hash } })) {
      hash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');
    }
    return hash;
  }

  async getHistoryUser(item: IMailSeedData): Promise<User> {
    const users = await this.usersRepository.find({
      where: { email: item.user.email as string },
    });
    return users[0];
  }

  printResults() {
    logLog(this.logger, 'NEW USERS:');
    logWarn(this.logger,
      'The passwords shown are always new but if user exists the current password in DB wont be updated.\n' +
      'Save these passwords in the first run or remove these users before seed',
    );
    for (const item of this.newMails) {
      logLog(this.logger, item);
    }
  }
}
