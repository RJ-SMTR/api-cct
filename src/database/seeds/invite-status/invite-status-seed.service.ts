import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InviteStatus } from 'src/invite-statuses/entities/invite-status.entity';
import { InviteStatusEnum } from 'src/invite-statuses/invite-status.enum';
import { Repository } from 'typeorm';

@Injectable()
export class InviteStatusSeedService {
  constructor(
    @InjectRepository(InviteStatus)
    private repository: Repository<InviteStatus>,
  ) {}

  async run() {
    for (const value in InviteStatusEnum) {
      console.log(value);
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
            name: InviteStatusEnum[value],
          }),
        );
      }
    }
  }
}
