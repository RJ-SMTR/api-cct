import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { ExtratoDashboardService, FiltroDetalheExtrato } from '../service/extrato/extrato-dashboard.service';
import { ContaExtrato } from '../service/extrato/extrato-dashboard.utils';

const filtroDaQuery = (q: Record<string, string>): FiltroDetalheExtrato => ({
  dataInicio: q.dataInicio,
  dataFim: q.dataFim,
  conta: q.conta as ContaExtrato,
  tipo: q.tipo as 'C' | 'D' | undefined,
  descricao: q.descricao?.slice(0, 100),
  dia: q.dia,
  busca: q.busca?.slice(0, 100),
  page: Number(q.page),
  pageSize: Number(q.pageSize),
});

@ApiTags('ExtratoDashboard')
@Controller({ path: 'extrato/dashboard', version: '1' })
@Roles(RoleEnum.master, RoleEnum.admin, RoleEnum.lancador_financeiro, RoleEnum.aprovador_financeiro)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class ExtratoDashboardController {
  constructor(private readonly service: ExtratoDashboardService) {}

  /** Entradas, saídas, movimento por dia e por histórico de cada conta no período. */
  @Get('resumo')
  @HttpCode(HttpStatus.OK)
  resumo(@Query('dataInicio') dataInicio: string, @Query('dataFim') dataFim: string) {
    return this.service.resumo({ dataInicio, dataFim });
  }

  /** Lançamentos que compõem um ponto do dashboard, paginados. */
  @Get('detalhe')
  @HttpCode(HttpStatus.OK)
  detalhe(@Query() q: Record<string, string>) {
    return this.service.detalhe(filtroDaQuery(q));
  }

  @Get('exportar')
  @HttpCode(HttpStatus.OK)
  exportar(@Query() q: Record<string, string>) {
    return this.service.exportar(filtroDaQuery(q));
  }
}
