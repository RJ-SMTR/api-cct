import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { Repository } from 'typeorm';

@Injectable()
export class StatusSeedService {
  constructor(
    @InjectRepository(Status)
    private repository: Repository<Status>,
  ) {}

  async run() {
    for (const value in StatusEnum) {
      if (isNaN(Number(value))) {
        continue;
      }

      const count = await this.repository.count({
        where: {
          name: value,
        },
      });

      if (!count) {
        await this.repository.save(
          this.repository.create({
            id: Number(value),
            name: StatusEnum[value],
          }),
        );
      }
    }
  }
}
