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
    let nextId = await this.getNextId();
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
              id: nextId,
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
          nextId++;
        }
      }
    }
  }

  private async getNextId(): Promise<number> {
    const lastSetting = await this.repository.find({
      order: { id: 'DESC' },
      take: 1,
    });

    return (lastSetting[0]?.id ?? 0) + 1;
  }
}
