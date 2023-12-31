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

@Injectable()
export class MailHistorySeedService {
  private logger = new Logger('MailHistorySeedService', { timestamp: true });

  constructor(
    @InjectRepository(MailHistory)
    private mailHistoryRepository: Repository<MailHistory>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private mhSeedDataService: MailHistorySeedDataService,
    private userSeedDataService: UserSeedDataService,
  ) {}

  async run() {
    if (!(await this.validateRun())) {
      this.logger.log('Database is not empty. Aborting seed...');
      return;
    }
    this.logger.log('run()');
    for (const item of this.mhSeedDataService.getDataFromConfig()) {
      const itemUser = await this.getHistoryUser(item);
      const itemSeedUser = this.userSeedDataService
        .getDataFromConfig()
        .find((i) => i.email === itemUser.email);
      const foundItem = await this.mailHistoryRepository.findOne({
        where: {
          user: { email: itemUser.email as string },
        },
      });

      if (!foundItem) {
        const newItem = { ...item };
        newItem.user = itemUser;
        newItem.email = itemUser.email as string;
        newItem.hash = await this.generateInviteHash();
        if (itemSeedUser?.inviteStatus) {
          newItem.inviteStatus = itemSeedUser.inviteStatus;
        }
        this.logger.log(`Creating user: ${JSON.stringify(newItem)}`);
        await this.mailHistoryRepository.save(
          this.mailHistoryRepository.create(newItem),
        );
        itemUser.hash = newItem.hash;
        await this.usersRepository.save(this.usersRepository.create(itemUser));
      }
    }
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

  async validateRun() {
    return global.force || (await this.usersRepository.count()) === 0;
  }
}
