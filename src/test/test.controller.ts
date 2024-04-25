import {
  Controller,
  Get,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AllConfigType } from 'src/config/config.type';
import { CronJobsService } from 'src/cron-jobs/cron-jobs.service';
import { FileTypeValidationPipe } from 'src/utils/file-type/pipes/file-type-validation.pipe';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { TestEnvironmentsGuard } from './test-environments.guard';
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

  //   @Get()
  //   async getAll(): Promise<NullableType<Info[]>> {
  //     return this.infoService.find();
  //   }

  @Get('cron-jobs/bulk-send-invites')
  @ApiOperation({
    description:
      'Only available in test environments.' +
      '\n\nUsed by e2e tests to make use of cronjob task without waiting required time.',
  })
  async getCronJobsBulkSendInvites() {
    await this.testService.getCronJobsBulkSendInvites();
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

  @Get('users/invalid-cpf')
  @ApiOperation({
    description:
      'Only available in test environments.' +
      "\n\nUsed by e2e tests to reset example users' state before testing.",
  })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'cpfCnpj', required: false })
  async getUsersInvalidCPFs(
    @Query('email') email?: string,
    @Query('cpfCnpj') cpfCnpj?: string,
  ) {
    return await this.testService.getInvaidCPFs({ email, cpfCnpj });
  }

  @Post('users/update-files')
  @ApiOperation({
    description:
      'Only available in test environments.' +
      "\n\nUsed by e2e tests to reset example users' state before testing.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Allowed files: spreadsheet, csv',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files'))
  @UsePipes(new FileTypeValidationPipe(['spreadsheet', 'csv']))
  async postUsersUpdateFiles(
    @Request() request: IRequest,
    @UploadedFiles() files: Array<Express.Multer.File | Express.MulterS3.File>,
  ) {
    return await this.testService.updateUserFiles(files, request);
  }
}
