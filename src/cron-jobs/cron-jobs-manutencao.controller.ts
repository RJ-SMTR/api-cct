import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CnabService } from 'src/cnab/cnab.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { CronJobsService } from './cron-jobs.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { ApiDescription } from 'src/utils/api-param/description-api-param';
import { ParseDatePipe } from 'src/utils/pipes/parse-date.pipe';

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

  @Get('generateRemessaVLT')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta a geração e envio de remessa - exatamente como no cronjob.' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'today', type: String, required: false, description: ApiDescription({ _: "Define uma data customizada para 'hoje'", example: '2024-07-15' }) })
  @ApiQuery({ name: 'force', type: Boolean, required: false, description: 'Ignora validação de data e afins no método do cronjob, e executa mesmo assim', example: false })
  async getGenerateRemessaVLT(
    @Query('today', new ParseDatePipe({ optional: true, transform: true })) today: Date | undefined, //
    @Query('force') force: boolean | undefined,
  ) {
    await this.cronJobsService.generateRemessaVLT({ today, force });
  }

  @Get('generateRemessaEmpresa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta a geração e envio de remessa - exatamente como no cronjob.' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'today', type: String, required: false, description: ApiDescription({ _: "Define uma data customizada para 'hoje'", example: '2024-07-15' }) })
  @ApiQuery({ name: 'force', type: Boolean, required: false, description: 'Ignora validação de data e afins no método do cronjob, e executa mesmo assim', example: false })
  async getGenerateRemessaConsorcio(
    @Query('today', new ParseDatePipe({ optional: true, transform: true })) today: Date | undefined, //
    @Query('force') force: boolean | undefined,
  ) {
    await this.cronJobsService.generateRemessaEmpresa({ today, force });
  }

  @Get('generateRemessaVanzeiros')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.master)
  @ApiOperation({ description: 'Feito para manutenção pelos admins.\n\nExecuta a geração e envio de remessa - exatamente como no cronjob.' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'today', type: String, required: false, description: ApiDescription({ _: "Define uma data customizada para 'hoje'", example: '2024-07-15' }) })
  @ApiQuery({ name: 'force', type: Boolean, required: false, description: 'Ignora validação de data e afins no método do cronjob, e executa mesmo assim', example: false })
  async getGenerateRemessaVanzeiros(
    @Query('today', new ParseDatePipe({ optional: true, transform: true })) today: Date | undefined, //
    @Query('force') force: boolean | undefined,
  ) {
    await this.cronJobsService.generateRemessaVanzeiros({ today, force });
  }
}
