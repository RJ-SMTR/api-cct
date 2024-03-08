import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllConfigType } from 'src/config/config.type';
import { CronJobsService } from 'src/cron-jobs/cron-jobs.service';
import { TestEnvironmentsGuard } from 'src/test/test-environments.guard';
import { TestService } from './test.service';

@Controller({
  path: 'test',
  version: '1',
})
@ApiTags('Test')
@UseGuards(TestEnvironmentsGuard)
export class TestController {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly cronjobsService: CronJobsService,
    private readonly testService: TestService,
  ) {}

  @Get('test-environments-guard')
  @ApiOperation({
    description:
      'Only available in test environments.' +
      '\n\nTo check if any test endpoint is blocked when `NODE_ENV` value is not for testing.',
  })
  getTestEnvironmentsGuard() {
    return {
      message: 'ok',
      nodeEnv: this.configService.getOrThrow('app.nodeEnv', { infer: true }),
    };
  }

  @Get('cron-jobs/bulk-resend-invites')
  @ApiOperation({
    description:
      'Only available in test environments.' +
      '\n\nUsed by e2e tests to make use of cronjob task without waiting required time.',
  })
  async getCronJobsBulkResendInvites() {
    await this.testService.getCronJobsBulkResendInvites();
  }

  @Get('users/reset-testing-users')
  @ApiOperation({
    description:
      'Only available in test environments.' +
      "\n\nUsed by e2e tests to reset example users' state before testing.",
  })
  async getUsersResetTestUsers() {
    await this.testService.getResetTestingUsers();
  }
}
