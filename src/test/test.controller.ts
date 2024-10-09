import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AllConfigType } from 'src/config/config.type';
import { CronJobsService } from 'src/cron-jobs/cron-jobs.service';
import { TestEnvironmentsGuard } from 'src/test/test-environments.guard';
import { TestService } from './test.service';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { DetalheAService } from 'src/cnab/service/pagamento/detalhe-a.service';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';

@Controller({
  path: 'test',
  version: '1',
})
@ApiTags('Test')
@UseGuards(TestEnvironmentsGuard)
export class TestController {
  constructor(
    private readonly configService: ConfigService<AllConfigType>, //
    private readonly cronjobsService: CronJobsService,
    private readonly testService: TestService,
    private readonly mailHistoryService: MailHistoryService,
    private readonly detalheAService: DetalheAService,
  ) {}

  @Get('test-environments-guard')
  @ApiOperation({
    description: 'Only available in test environments.' + '\n\nTo check if any test endpoint is blocked when `NODE_ENV` value is not for testing.',
  })
  getTestEnvironmentsGuard() {
    return {
      message: 'ok',
      nodeEnv: this.configService.getOrThrow('app.nodeEnv', { infer: true }),
    };
  }

  @Get('cron-jobs/bulk-send-invites')
  @ApiOperation({
    description: 'Only available in test environments.' + '\n\nUsed by e2e tests to make use of cronjob task without waiting required time.',
  })
  async getCronJobsBulkSendInvites() {
    await this.testService.getCronJobsBulkSendInvites();
  }

  @Get('cron-jobs/bulk-resend-invites')
  @ApiOperation({
    description: 'Only available in test environments.' + '\n\nUsed by e2e tests to make use of cronjob task without waiting required time.',
  })
  async getCronJobsBulkResendInvites() {
    await this.testService.getCronJobsBulkResendInvites();
  }

  @Get('users/reset-testing-users')
  @ApiOperation({
    description: 'Only available in test environments.' + "\n\nUsed by e2e tests to reset example users' state before testing.",
  })
  async getUsersResetTestUsers() {
    await this.testService.getResetTestingUsers();
  }

  @Get('users/invalid-cpf')
  @ApiOperation({
    description: 'Only available in test environments.' + "\n\nUsed by e2e tests to reset example users' state before testing.",
  })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'cpfCnpj', required: false })
  async getUsersInvalidCPFs(
    @Query('email') email?: string, //
    @Query('cpfCnpj') cpfCnpj?: string,
  ) {
    return await this.testService.getInvaidCPFs({ email, cpfCnpj });
  }

  @Get('mail-history/generate-hash')
  @ApiOperation({
    description: 'Only available in test environments.' + "\n\nUsed by e2e tests to reset example users' state before testing.",
  })
  async getMailHistoryGenerateHash() {
    return await this.mailHistoryService.generateHash();
  }

  @Get('detalhe-a/getNextNumeroDocumento')
  @ApiOperation({
    description: 'Only available in test environments.' + "\n\nUsed by e2e tests to reset example users' state before testing.",
  })
  @ApiQuery({ name: 'date', required: false, description: ApiDescription({ default: 'o dia de hoje' }) })
  async getDetalheAGetNextNumeroDocumento(
    @Query('date', new ParseDatePipe({ default: new Date() })) _date: Date | undefined, //
  ) {
    const date = _date as Date;
    return await this.detalheAService.getNextNumeroDocumento(date);
  }
}
