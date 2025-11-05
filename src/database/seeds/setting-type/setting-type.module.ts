import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingTypeSeedService } from './setting-type.service';
import { SettingType } from 'src/configuration/setting-types/entities/setting-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SettingType])],
  providers: [SettingTypeSeedService],
  exports: [SettingTypeSeedService],
})
export class SettingTypeSeedModule {}
