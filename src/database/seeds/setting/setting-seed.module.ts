import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingSeedService } from './setting-seed.service';
import { SettingEntity } from 'src/settings/entities/setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SettingEntity])],
  providers: [SettingSeedService],
  exports: [SettingSeedService],
})
export class SettingSeedModule {}
