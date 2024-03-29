import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';
import { MailModule } from 'src/mail/mail.module';
import { SettingsModule } from 'src/settings/settings.module';
import { ConfigModule } from '@nestjs/config';
import { JaeModule } from 'src/jae/jae.module';
import { CoreBankModule } from 'src/core-bank/core-bank.module';
import { UsersModule } from 'src/users/users.module';
import { MailCountModule } from 'src/mail-count/mail-count.module';
import { CronJobsModule } from 'src/cron-jobs/cron-jobs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    SettingsModule,
    MailHistoryModule,
    MailModule,
    UsersModule,
    JaeModule,
    CoreBankModule,
    MailCountModule,
    CronJobsModule,
  ],
})
export class TestModule {}
