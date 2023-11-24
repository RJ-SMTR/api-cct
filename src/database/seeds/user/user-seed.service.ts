import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { UserDataInterface } from 'src/users/interfaces/user-data.interface';
import { Repository } from 'typeorm';
import { UserSeedDataService } from './user-seed-data.service';
import * as crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';

@Injectable()
export class UserSeedService {
  private logger = new Logger('UserSeedService', { timestamp: true });
  private newUsers: Partial<UserDataInterface>[] = [];

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataService: UserSeedDataService,
  ) {}

  async run() {
    this.logger.log('run()');
    for (const item of this.dataService.getDataFromConfig()) {
      const foundItem = await this.usersRepository.findOne({
        where: {
          email: item.email,
        },
      });

      if (!foundItem) {
        item.hash = await this.generateHash();
        this.newUsers.push({
          fullName: item.fullName,
          email: item.email,
          ...(item.password ? { password: item.password } : {}),
        });
        await this.usersRepository.save(this.usersRepository.create(item));
      }
    }
    if (this.newUsers.length) {
      this.printPasswords();
    }
  }

  printPasswords() {
    this.logger.log('NEW USERS:');
    this.logger.warn(
      'The passwords shown are always new but if user exists the current password in DB wont be updated.\n' +
        'Save these passwords in the first run or remove these users before seed',
    );
    for (const item of this.newUsers) {
      this.logger.log({
        name: item.fullName,
        email: item.email,
        password: item.password,
      });
    }
  }

  async generateHash(): Promise<string> {
    let hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');
    while (await this.usersRepository.findOne({ where: { hash } })) {
      hash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');
    }
    return hash;
  }
}
