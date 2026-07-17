import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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

  @Get('/sync-weekly-agent-users')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dispara manualmente a sincronização semanal de agentes',
    description:
      'Executa o fluxo de sync de agentes fora da agenda do cron. ' +
      'O fluxo usa a mesma tabela BigQuery fixa da execução agendada. ' +
      'O endpoint pode criar usuários e enfileirar convites no banco atual.',
  })
  async triggerSyncWeeklyAgentUsers() {
    const result = await this.cronJobsService.syncWeeklyAgentUsers();

    return {
      success: true,
      result,
      triggeredAt: new Date().toISOString(),
    };
  }

  @Get('/test-backup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Testa o backup selecionado do SFTP para GCS',
    description: 'Faz backup apenas das pastas: /backup/extrato/success/2026, /backup/remessa/2026, /backup/retorno/success/2026, /enviados, /retorno'
  })
  async testBackup() {
    const METHOD = 'testBackup';
    try {
      this.logger.log('Iniciando teste de backup selecionado...', METHOD);
      await this.cronJobsService.fullBackup();
      return {
        success: true,
        message: 'Backup selecionado finalizado com sucesso!',
        folders: [
          '/backup/extrato/success/2026',
          '/backup/remessa/2026',
          '/backup/retorno/success/2026',
          '/enviados',
          '/retorno'
        ],
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
