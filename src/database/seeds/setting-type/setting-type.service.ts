import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SettingType } from 'src/setting-types/entities/setting-type.entity';
import { SettingTypeEnum } from 'src/setting-types/setting-type.enum';
import { Repository } from 'typeorm';

@Injectable()
export class SettingTypeSeedService {
  constructor(
    @InjectRepository(SettingType)
    private repository: Repository<SettingType>,
  ) {}

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    for (const value in SettingTypeEnum) {
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
            name: SettingTypeEnum[value],
          }),
        );
      }
    }
  }
}
