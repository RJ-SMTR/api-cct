import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailHistory } from 'src/domain/entity/mail-history.entity';
import { MailHistoryModule } from 'src/module/mail-history.module';
import { UserSeedModule } from '../user/user-seed.module';
import { MailHistorySeedDataService } from './mail-history-seed-data.service';
import { MailHistorySeedService } from './mail-history-seed.service';
import { User } from 'src/domain/entity/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MailHistory]),
    TypeOrmModule.forFeature([User]),
    MailHistoryModule,
    UserSeedModule,
  ],
  providers: [MailHistorySeedService, MailHistorySeedDataService],
  exports: [MailHistorySeedService],
})
export class MailHistorySeedModule {}
