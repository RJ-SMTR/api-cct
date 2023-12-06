import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { IsNull, Repository } from 'typeorm';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingEntity } from './entities/setting.entity';
import { SettingDataInterface } from './interfaces/setting-data.interface';

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
    return this.settingsRepository.save(setting);
  }
}
