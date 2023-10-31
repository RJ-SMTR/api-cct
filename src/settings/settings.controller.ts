import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  SerializeOptions,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { NullableType } from 'src/utils/types/nullable.type';
import { SettingEntity } from './entities/setting.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAll(): Promise<NullableType<SettingEntity[]>> {
    return this.settingsService.find();
  }

  @Get('v:version')
  @ApiParam({ name: 'version', example: '1' })
  getByVersion(
    @Param('version') version: string,
  ): Promise<NullableType<SettingEntity[]>> {
    return this.settingsService.findByVersion(version);
  }

  @SerializeOptions({
    groups: ['admin'],
  })
  @Patch()
  @HttpCode(HttpStatus.OK)
  update(@Body() updateSettingDto: UpdateSettingsDto): Promise<SettingEntity> {
    return this.settingsService.update(updateSettingDto);
  }
}
