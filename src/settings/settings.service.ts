import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { IsNull, Like, Repository } from 'typeorm';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingEntity } from './entities/setting.entity';
import { ISettingDataGroup } from './interfaces/setting-data-group.interface';
import { ISettingData } from './interfaces/setting-data.interface';
import { appSettings } from './app.settings';

@Injectable()
export class SettingsService {
  private logger = new Logger(SettingsService.name, { timestamp: true });

  constructor(
    @InjectRepository(SettingEntity)
    private readonly settingsRepository: Repository<SettingEntity>,
  ) {}

  async find(
    fields?: EntityCondition<SettingEntity>,
  ): Promise<Nullable<SettingEntity[]>> {
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
    setting: ISettingData,
    defaultValueIfNotFound?: boolean,
    logContext?: string,
  ): Promise<SettingEntity> {
    const METHOD = logContext
      ? `${logContext}>${this.getOneBySettingData.name}`
      : this.getOneBySettingData.name;
    const dbSetting = await this.findOneBySettingData(setting);
    if (defaultValueIfNotFound && !dbSetting) {
      this.logger.warn(
        `Configuração 'setting.${setting.name}' não encontrada. Usando valor padrão: '${setting.value}'.`,
        METHOD,
      );
      return new SettingEntity(setting);
    } else {
      return this.getOneByNameVersion(setting.name, setting.version);
    }
  }

  async findOneBySettingData(
    setting: ISettingData,
  ): Promise<SettingEntity | null> {
    const settings = await this.settingsRepository.find({
      where: {
        name: setting.name,
        version: setting.version === null ? IsNull() : setting.version,
      },
    });
    if (settings.length === 0) {
      return null;
    } else {
      return settings[0];
    }
  }

  async findManyBySettingDataGroup(
    setting: ISettingDataGroup,
  ): Promise<SettingEntity[]> {
    return await this.settingsRepository.find({
      where: {
        name: Like(`%${setting.baseName}%`),
        version: setting.baseVersion === null ? IsNull() : setting.baseVersion,
      },
    });
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

  async update(dto: UpdateSettingsDto): Promise<SettingEntity> {
    const setting = await this.getOneByNameVersion(dto.name, dto.version);
    setting.value = dto.value;
    return this.settingsRepository.save(setting);
  }

  async updateBySettingData(
    settingData: ISettingData,
    value: string,
  ): Promise<SettingEntity> {
    const dbSetting = await this.getOneBySettingData(settingData);
    await this.settingsRepository.update(
      { id: dbSetting.id },
      { value: value },
    );
    const updated = await this.getOneBySettingData(settingData);
    return updated;
  }

  async confirmNSR() {
    const currentNsrSequence = await this.getOneBySettingData(
      appSettings.any__cnab_current_nsr_sequence,
    );
    await this.updateBySettingData(
      appSettings.any__cnab_last_nsr_sequence,
      currentNsrSequence.value,
    );
  }

  async revertNSR() {
    const lastNsrSequence = await this.getOneBySettingData(
      appSettings.any__cnab_last_nsr_sequence,
    );
    await this.updateBySettingData(
      appSettings.any__cnab_current_nsr_sequence,
      lastNsrSequence.value,
    );
  }
}
