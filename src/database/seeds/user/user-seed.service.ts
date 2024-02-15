import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { UserSeedDataService } from './user-seed-data.service';
import * as crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { UserDataInterface } from 'src/users/interfaces/user-data.interface';

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
    const userFixtures = await this.userSeedDataService.getDataFromConfig();
    for (const userFixture of userFixtures) {
      const foundUserFixture = await this.userSeedRepository.findOne({
        where: {
          email: userFixture.email,
        },
      });

      let createdItem: User;
      if (foundUserFixture) {
        const newUser = new User(foundUserFixture);
        newUser.update(userFixture, true);
        await this.userSeedRepository.save(
          this.userSeedRepository.create(newUser),
        );
        createdItem = (await this.userSeedRepository.findOne({
          where: {
            email: userFixture.email as string,
          },
        })) as User;
      } else {
        createdItem = await this.userSeedRepository.save(
          this.userSeedRepository.create(userFixture),
        );
      }
      userFixture.hash = await this.generateHash();
      this.pushNewUser(userFixture, foundUserFixture, createdItem);
    }

    if (this.newUsers.length) {
      this.printResults();
    } else {
      this.logger.log('No new users changed.');
    }
  }

  pushNewUser(
    userFixture: UserDataInterface,
    foundUserFixture: User | null,
    createdItem: User,
  ) {
    this.newUsers.push({
      status: foundUserFixture ? 'updated' : 'created',
      fullName: userFixture.fullName,
      email: userFixture.email,
      password: userFixture.password,
      cpfCnpj: userFixture.cpfCnpj,
      hashedPassword: createdItem.password,
    });
  }

  printResults() {
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
