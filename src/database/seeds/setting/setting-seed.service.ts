import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SettingTypeEnum } from 'src/setting-types/setting-type.enum';
import { SettingEntity } from 'src/settings/entities/setting.entity';
import { ISettingData } from 'src/settings/interfaces/setting-data.interface';
import { Enum } from 'src/utils/enum';
import { IsNull, Repository } from 'typeorm';
import { settingSeedData } from './setting-seed-data';
import { Environment } from 'src/config/app.config';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';

@Injectable()
export class SettingSeedService {
  constructor(
    @InjectRepository(SettingEntity)
    private repository: Repository<SettingEntity>,
  ) {}

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    let id = 1;
    console.log('SEED', process.env.NODE_ENV);
    console.log(
      'VALUE',
      process.env.NODE_ENV === Environment.Local ||
        process.env.NODE_ENV === Environment.Test
        ? BigqueryEnvironment.Development
        : BigqueryEnvironment.Production,
    );
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
