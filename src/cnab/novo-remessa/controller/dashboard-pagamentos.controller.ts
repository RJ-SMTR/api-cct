import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { DashboardPagamentosDetalheQueryDto, DashboardPagamentosResumoQueryDto } from '../dto/dashboard-pagamentos.dto';
import { DashboardPagamentosService } from '../service/dashboard-pagamentos.service';

@ApiTags('DashboardPagamentos')
@Controller({
  path: 'dashboard/pagamentos',
  version: '1',
})
export class DashboardPagamentosController {
  constructor(private readonly dashboardPagamentosService: DashboardPagamentosService) {}

  /** Conta Bilhetagem, Conta Rotativo e Conta CETT: pago, não pago e em aberto por consórcio/modal, com motivos. */
  @Get('resumo')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async resumo(@Query() query: DashboardPagamentosResumoQueryDto) {
    return this.dashboardPagamentosService.resumo({ dataInicio: query.dataInicio, dataFim: query.dataFim });
  }

  /** Pagamentos que compõem um ponto do gráfico (conta, grupo, situação e/ou motivo), paginados. */
  @Get('detalhe')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async detalhe(@Query() query: DashboardPagamentosDetalheQueryDto) {
    return this.dashboardPagamentosService.detalhe(query);
  }
}
