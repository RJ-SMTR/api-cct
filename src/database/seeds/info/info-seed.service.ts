import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Info } from 'src/info/entities/info.entity';
import { Repository } from 'typeorm';
import { infoData } from './info-data';

@Injectable()
export class InfoSeedService {
  constructor(
    @InjectRepository(Info)
    private repository: Repository<Info>,
  ) {}

  async run() {
    let id = 1;
    for (const item of infoData) {
      const count = await this.repository.count({
        where: {
          name: item.name,
        },
      });

      if (!count) {
        await this.repository.save(
          this.repository.create({
            id: id,
            name: item.name,
            value: item.value,
          }),
        );
      }
      id++;
    }
  }
}
