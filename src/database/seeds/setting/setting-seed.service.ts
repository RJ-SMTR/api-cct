import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { settingSeedData } from './setting-seed-data';
import { SettingEntity } from 'src/settings/entities/setting.entity';
import { SettingTypeEnum } from 'src/setting-types/setting-type.enum';
import { Enum } from 'src/utils/enum';

@Injectable()
export class SettingSeedService {
  constructor(
    @InjectRepository(SettingEntity)
    private repository: Repository<SettingEntity>,
  ) {}

  async run() {
    let id = 1;
    for (const item of settingSeedData) {
      const count = await this.repository.count({
        where: {
          name: item.name,
          version: item.version === null ? IsNull() : item.version,
          settingType: {
            id: item.settingType,
            name: Enum.getKey(SettingTypeEnum, item.settingType),
          },
        },
      });

      if (!count) {
        await this.repository.save(
          this.repository.create({
            id: id,
            name: item.name,
            value: item.value,
            version: item.version,
            editable: item.editable,
            settingType: {
              id: item.settingType,
              name: Enum.getKey(SettingTypeEnum, item.settingType),
            },
          }),
        );
      }
      id++;
    }
  }
}
