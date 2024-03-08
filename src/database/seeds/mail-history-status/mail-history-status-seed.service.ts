import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { Repository } from 'typeorm';

@Injectable()
export class InviteStatusSeedService {
  constructor(
    @InjectRepository(InviteStatus)
    private repository: Repository<InviteStatus>,
  ) {}

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    for (const value in InviteStatusEnum) {
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
