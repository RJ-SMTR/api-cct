import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CnabModule } from 'src/configuration/cnab/cnab.module';
import { MailCountModule } from 'src/module/mail-count.module';
import { MailHistoryModule } from 'src/module/mail-history.module';
import { MailModule } from 'src/module/mail.module';
import { SettingsModule } from 'src/configuration/settings/settings.module';
import { CronJobsService } from '../service/cron-jobs.service';
import { UsersModule } from 'src/module/users.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    SettingsModule,
    MailHistoryModule,
    MailModule,
    UsersModule,
    MailCountModule,
    CnabModule    
  ],
  providers: [CronJobsService],
  exports: [CronJobsService],
})
export class CronJobsModule {}
