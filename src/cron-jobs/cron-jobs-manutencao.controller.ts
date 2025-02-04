import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CustomLogger } from 'src/utils/custom-logger';
import { CronJobsService } from './cron-jobs.service';

@ApiTags('Manutenção')
@Controller({
  path: 'manutencao/cron-jobs',
  version: '1',
})
export class CronJobsManutencaoController {
  private logger = new CustomLogger(CronJobsManutencaoController.name, { timestamp: true });

  constructor(
    private readonly cronJobsService: CronJobsService, //
  ) {}


}
