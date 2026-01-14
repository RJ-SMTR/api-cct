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

  @Get('/test-backup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Testa o backup completo do SFTP para GCS' })
  async testBackup() {
    const METHOD = 'testBackup';
    try {
      this.logger.log('Iniciando teste de backup...', METHOD);
      await this.cronJobsService.fullBackup();
      return {
        success: true,
        message: 'Backup finalizado com sucesso!',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erro no teste de backup: ${error.message}`, error?.stack, METHOD);
      return {
        success: false,
        message: `Erro ao executar backup: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
