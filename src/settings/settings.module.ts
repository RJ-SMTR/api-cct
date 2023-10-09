import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { SettingEntity } from './entities/setting.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { IsMatchingTypeConstraint } from 'src/utils/validators/is-matching-type.validator';

@Module({
  imports: [TypeOrmModule.forFeature([SettingEntity])],
  controllers: [SettingsController],
  providers: [SettingsService, IsNotExist, IsMatchingTypeConstraint],
  exports: [SettingsService],
})
export class SettingsModule {}
