import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailCountSeedService } from './mail-count-seed.service';
import { MailCount } from 'src/domain/entity/mail-count.entity';
import { ConfigModule } from '@nestjs/config';
import { MailCountSeedDataService } from './mail-count-seed-data.service';

@Module({
  imports: [TypeOrmModule.forFeature([MailCount]), ConfigModule],
  providers: [MailCountSeedService, MailCountSeedDataService],
  exports: [MailCountSeedService],
})
export class MailCountSeedModule {}
