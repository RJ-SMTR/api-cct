import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { TestEnvironmentsGuard } from './test-environments.guard';
import { CronJobsModule } from 'src/cron-jobs/cron-jobs.module';
import { TestService } from './test.service';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';
import { UsersModule } from 'src/users/users.module';
import { CnabModule } from 'src/cnab/cnab.module';

@Module({
  imports: [CronJobsModule, MailHistoryModule, UsersModule, CnabModule],
  controllers: [TestController],
  providers: [TestEnvironmentsGuard, TestService],
})
export class TestModule {}
