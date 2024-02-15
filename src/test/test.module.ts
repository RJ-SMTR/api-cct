import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { TestEnvironmentsGuard } from './test-environments.guard';
import { CronJobsModule } from 'src/cron-jobs/cron-jobs.module';
import { TestService } from './test.service';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';

@Module({
  imports: [CronJobsModule, MailHistoryModule],
  controllers: [TestController],
  providers: [TestEnvironmentsGuard, TestService],
})
export class TestModule {}
