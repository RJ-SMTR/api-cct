import { Injectable, Logger } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { IMailSeedData } from 'src/mail-history/interfaces/mail-history-data.interface';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { MailHistorySeedDataService } from './mail-history-seed-data.service';

@Injectable()
export class MailHistorySeedService {
  private logger = new Logger('MailHistorySeedService', { timestamp: true });

  constructor(
    @InjectRepository(MailHistory)
    private mailHistoryRepository: Repository<MailHistory>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataService: MailHistorySeedDataService,
  ) {}

  async run() {
    if (!(await this.validateRun())) {
      this.logger.log('Database is not empty. Aborting seed...');
      return;
    }
    this.logger.log('run()');
    for (const item of this.dataService.getDataFromConfig()) {
      const itemUser = await this.getHistoryUser(item);
      item.user = itemUser;
      const foundItem = await this.mailHistoryRepository.findOne({
        where: {
          user: { id: itemUser.id },
        },
      });

      if (!foundItem) {
        item.email = item.user.email as string;
        item.hash = await this.generateInviteHash();
        await this.mailHistoryRepository.save(
          this.mailHistoryRepository.create(item),
        );
        itemUser.hash = item.hash;
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
