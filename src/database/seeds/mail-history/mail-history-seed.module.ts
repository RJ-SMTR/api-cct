import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';
import { User } from 'src/users/entities/user.entity';
import { MailHistorySeedDataService } from './mail-history-seed-data.service';
import { MailHistorySeedService } from './mail-history-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MailHistory]),
    TypeOrmModule.forFeature([User]),
    MailHistoryModule,
  ],
  providers: [MailHistorySeedService, MailHistorySeedDataService],
  exports: [MailHistorySeedService],
})
export class MailHistorySeedModule {}
