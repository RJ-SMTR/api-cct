import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailCount } from 'src/domain/entity/mail-count.entity';
import { MailCountSeedDataService } from './mail-count-seed-data.service';

@Injectable()
export class MailCountSeedService {
  constructor(
    @InjectRepository(MailCount)
    private repository: Repository<MailCount>,
    private dataService: MailCountSeedDataService,
  ) { }

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    let id = 1;
    for (const item of this.dataService.getData()) {
      const count = await this.repository.count({
        where: {
          email: item.email,
          maxRecipients: item.maxRecipients,
        },
      });

      if (!count) {
        console.warn('item not found');
        await this.repository.save(
          this.repository.create({
            id: id,
            email: item.email,
            maxRecipients: item.maxRecipients,
            recipientCount: item?.recipientCount || 0,
          }),
        );
      }
      id++;
    }
  }
}
