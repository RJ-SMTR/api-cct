import { Controller, Get, HttpCode, HttpException, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { CronJobsService } from 'src/service/cron-jobs.service';

import { PendentesQueryDTO } from '../domain/dto/pagamento-pendente.dto';

@ApiTags('Pendentes')
@Controller({
  path: 'pendentes',
  version: '1',
})
export class PendenteController {
  constructor(
    private cronService: CronJobsService
  ) { }

  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('financial-movement')
  async pendentes(
    @Query(new ValidationPipe({ transform: true })) queryParams: PendentesQueryDTO,
  ) {
    try {


      const result = await this.cronService.remessaPendenteExec(
        queryParams.dataInicio.toDateString(), queryParams.dataFim.toDateString(), queryParams.dataPagamento.toDateString(), queryParams.IdOperadoras
      )
      return result;
    } catch (e) {
      return new HttpException({ error: e.message }, HttpStatus.BAD_REQUEST);
    }
  }
}
