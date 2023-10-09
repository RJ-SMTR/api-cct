import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SettingEntity } from './entities/setting.entity';
import { IsNull, Repository } from 'typeorm';
import { NullableType } from 'src/utils/types/nullable.type';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingDataInterface } from './interfaces/setting-data.interface';
import { appSettings } from './app.settings';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SettingEntity)
    private readonly settingsRepository: Repository<SettingEntity>,
  ) {}

  async find(
    fields?: EntityCondition<SettingEntity>,
  ): Promise<NullableType<SettingEntity[]>> {
    return this.settingsRepository.find({
      where: fields,
    });
  }

  async getOneByNameVersion(
    name: string,
    version: string | null,
  ): Promise<SettingEntity> {
    const settings = await this.settingsRepository.find({
      where: {
        name: name,
        version: version === null ? IsNull() : version,
      },
    });
    if (settings.length === 0) {
      throw new HttpException(
        {
          error: 'notFound',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (settings.length > 1) {
      throw new HttpException(
        {
          details: {
            message: 'expected 1 setting but found more',
            settingsFound: settings,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return settings[0];
  }

  async getOneBySettingData(
    setting: SettingDataInterface,
  ): Promise<SettingEntity> {
    return this.getOneByNameVersion(setting.name, setting.version);
  }

  async findByVersion(version: string): Promise<SettingEntity[]> {
    await this.getOneBySettingData(appSettings.any__activate_auto_send_invite);
    // If no version found, return empty to indicate it
    const count = await this.settingsRepository.count({
      where: { version: version },
    });

    if (count === 0) {
      return [];
    }

    // Otherwise, return settings for given version and for any version (null)
    return this.settingsRepository.find({
      where: [{ version: version }, { version: IsNull() }],
    });
  }

  async update(payload: UpdateSettingsDto): Promise<SettingEntity> {
    const setting = await this.getOneByNameVersion(
      payload.name,
      payload.version,
    );
    setting.value = payload.value;
    console.log('payload', payload);
    console.log('new setting', setting);
    return this.settingsRepository.save(setting);
  }
}
