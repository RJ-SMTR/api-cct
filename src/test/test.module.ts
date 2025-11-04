import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { TestEnvironmentsGuard } from './test-environments.guard';
import { CronJobsModule } from 'src/module/cron-jobs.module';
import { TestService } from './test.service';
import { MailHistoryModule } from 'src/module/mail-history.module';
import { CnabModule } from 'src/configuration/cnab/cnab.module';
import { UsersModule } from 'src/module/users.module';

@Module({
  imports: [CronJobsModule, MailHistoryModule, UsersModule, CnabModule],
  controllers: [TestController],
  providers: [TestEnvironmentsGuard, TestService],
})
export class TestModule {}
