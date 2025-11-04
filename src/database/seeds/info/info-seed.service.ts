import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Info } from 'src/domain/entity/info.entity';
import { Repository } from 'typeorm';
import { infoSeedData } from './info-seed-data';

@Injectable()
export class InfoSeedService {
  constructor(
    @InjectRepository(Info)
    private repository: Repository<Info>,
  ) {}

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    let id = 1;
    for (const item of infoSeedData) {
      const count = await this.repository.count({
        where: {
          name: item.name,
          version: item.version,
        },
      });

      if (!count) {
        await this.repository.save(
          this.repository.create({
            id: id,
            name: item.name,
            value: item.value,
            version: item.version,
          }),
        );
      }
      id++;
    }
  }
}
