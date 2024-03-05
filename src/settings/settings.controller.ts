import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { Nullable } from 'src/utils/types/nullable.type';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingEntity } from './entities/setting.entity';
import { SettingsService } from './settings.service';

@Controller('settings')
@ApiTags('Settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async getAll(): Promise<Nullable<SettingEntity[]>> {
    return this.settingsService.find();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('v:version')
  @ApiParam({ name: 'version', example: '1' })
  getByVersion(
    @Param('version') version: string,
  ): Promise<Nullable<SettingEntity[]>> {
    return this.settingsService.findByVersion(version);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Patch()
  update(@Body() updateSettingDto: UpdateSettingsDto): Promise<SettingEntity> {
    return this.settingsService.update(updateSettingDto);
  }
}
