import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SettingTypeEnum } from 'src/setting-types/setting-type.enum';
import { SettingEntity } from 'src/settings/entities/setting.entity';
import { ISettingData } from 'src/settings/interfaces/setting-data.interface';
import { Enum } from 'src/utils/enum';
import { IsNull, Repository } from 'typeorm';
import { settingSeedData } from './setting-seed-data';

@Injectable()
export class SettingSeedService {
  constructor(
    @InjectRepository(SettingEntity)
    private repository: Repository<SettingEntity>,
  ) {}

  async run() {
    let id = 1;
    for (const item of settingSeedData) {
      const settings: ISettingData[] = (item as any)?.data || [item];
      for (const setting of settings) {
        const itemFound = await this.repository.count({
          where: {
            name: setting.name,
            version: setting.version === null ? IsNull() : setting.version,
            settingType: {
              id: setting.settingType,
              name: Enum.getKey(SettingTypeEnum, setting.settingType),
            },
          },
        });

        if (!itemFound) {
          await this.repository.save(
            this.repository.create({
              id: id,
              name: setting.name,
              value: setting.value,
              version: setting.version,
              editable: setting.editable,
              settingType: {
                id: setting.settingType,
                name: Enum.getKey(SettingTypeEnum, setting.settingType),
              },
            }),
          );
        }
        id++;
      }
    }
  }
}
