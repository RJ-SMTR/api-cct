import { Module } from '@nestjs/common';
import { CronJobsService } from './cron-jobs.service';
import { ScheduleModule } from '@nestjs/schedule';
import { InviteModule } from 'src/invite/invite.module';
import { MailModule } from 'src/mail/mail.module';
import { SettingsModule } from 'src/settings/settings.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    SettingsModule,
    InviteModule,
    MailModule,
    UsersModule,
  ],
  providers: [CronJobsService],
})
export class CronJobsModule {}
