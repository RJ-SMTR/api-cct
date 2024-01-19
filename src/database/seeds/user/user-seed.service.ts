import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { UserSeedDataService } from './user-seed-data.service';
import * as crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';

@Injectable()
export class UserSeedService {
  private logger = new Logger('UserSeedService', { timestamp: true });
  private newUsers: any[] = [];

  constructor(
    @InjectRepository(User)
    private userSeedRepository: Repository<User>,
    private userSeedDataService: UserSeedDataService,
  ) {}

  async validateRun() {
    return global.force || (await this.userSeedRepository.count()) === 0;
  }

  async run() {
    this.logger.log(
      `run() ${this.userSeedDataService.getDataFromConfig().length} items`,
    );
    for (const item of this.userSeedDataService.getDataFromConfig()) {
      const foundItem = await this.userSeedRepository.findOne({
        where: {
          email: item.email,
        },
      });

      let createdItem: User;
      if (foundItem) {
        const newItem = new User(foundItem);
        newItem.update(item, true);
        await this.userSeedRepository.save(
          this.userSeedRepository.create(newItem),
        );
        createdItem = (await this.userSeedRepository.findOne({
          where: {
            email: newItem.email as string,
          },
        })) as User;
      } else {
        createdItem = await this.userSeedRepository.save(
          this.userSeedRepository.create(item),
        );
      }
      item.hash = await this.generateHash();
      this.newUsers.push({
        status: foundItem ? 'updated' : 'created',
        fullName: item.fullName,
        email: item.email,
        password: item.password,
        hashedPassword: createdItem.password,
      });
    }
    if (this.newUsers.length) {
      this.printPasswords();
    } else {
      this.logger.log('No new users created.');
    }
  }

  printPasswords() {
    this.logger.log('NEW USERS:');
    this.logger.warn(
      'The passwords shown are always new but if user exists the current password in DB wont be updated.\n' +
        'Save these passwords in the first run or remove these users before seed',
    );
    for (const item of this.newUsers) {
      this.logger.log(item);
    }
  }

  async generateHash(): Promise<string> {
    let hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');
    while (await this.userSeedRepository.findOne({ where: { hash } })) {
      hash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');
    }
    return hash;
  }
}
