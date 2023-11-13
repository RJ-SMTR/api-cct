import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { UserSeedDataService } from './user-seed-data.service';

@Injectable()
export class UserSeedService {
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
      }
      await this.repository.save(this.repository.create(item));
    }
  }
}
