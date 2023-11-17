import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { UserDataInterface } from 'src/users/interfaces/user-data.interface';
import { Repository } from 'typeorm';
import { UserSeedDataService } from './user-seed-data.service';

@Injectable()
export class UserSeedService {
  private logger = new Logger('UserSeedService', { timestamp: true });
  private savedUsers: UserDataInterface[] = [];

  constructor(
    @InjectRepository(User)
    private repository: Repository<User>,
    private dataService: UserSeedDataService,
  ) {}

  async run() {
    for (const item of this.dataService.getDataFromConfig()) {
      const foundItem = await this.repository.findOne({
        where: {
          email: item.email,
        },
      });

      if (foundItem) {
        item.id = foundItem.id;
        if (item.password !== 'secret') {
          item.password = foundItem.password;
        }
      }

      this.savedUsers.push(item);

      await this.repository.save(this.repository.create(item));
    }
    this.printPasswords();
  }

  printPasswords() {
    this.logger.log('SEED USER CREDENTIALS:');
    this.logger.warn(
      'The passwords shown are always new but if user exists the current password in DB wont be updated.\n' +
        'Save these passwords in the first run or remove these users before seed',
    );
    for (const item of this.dataService.getDataFromConfig()) {
      this.logger.log({
        name: item.fullName,
        email: item.email,
        password: item.password,
      });
    }
  }
}
