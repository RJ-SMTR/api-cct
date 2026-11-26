import { Controller, Get, HttpCode, HttpException, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardPagamentosResumoQueryDto } from 'src/cnab/novo-remessa/dto/dashboard-pagamentos.dto';
import { validarPeriodo } from 'src/cnab/novo-remessa/service/dashboard-pagamentos.service';
import { Roles } from 'src/roles/roles.decorator';
import { RoleEnum } from 'src/roles/roles.enum';
import { RolesGuard } from 'src/roles/roles.guard';
import { PagamentosIndevidosGuardadoresService, SituacaoIndevido } from '../service/pagamentos-indevidos-guardadores.service';

const filtroDaQuery = (q: Record<string, string>) => ({
  busca: q.busca?.slice(0, 100),
  situacao: (['devendo', 'quitado'].includes(q.situacao) ? q.situacao : undefined) as SituacaoIndevido | undefined,
});

@ApiTags('PagamentosIndevidosGuardadores')
@Controller({ path: 'pagamentos-indevidos/guardadores', version: '1' })
export class PagamentosIndevidosGuardadoresController {
  constructor(private readonly service: PagamentosIndevidosGuardadoresService) {}

  /** Pagamentos indevidos dos guardadores: indevido, já debitado e saldo devedor, paginado, com totais. */
  @Get()
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  listar(@Query() q: Record<string, string>) {
    return this.service.listar({ ...filtroDaQuery(q), page: Number(q.page), pageSize: Number(q.pageSize) });
  }

  /** Pagamentos com abatimento por duplicidade no período (quadro do Dashboard de Pagamentos), com totais. */
  @Get('abatimentos')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  abatimentos(@Query() query: DashboardPagamentosResumoQueryDto) {
    const periodo = { dataInicio: query.dataInicio, dataFim: query.dataFim };
    validarPeriodo(periodo);
    return this.service.abatimentos(periodo);
  }

  @Get('exportar')
  @Roles(RoleEnum.master, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async exportar(@Query() q: Record<string, string>) {
    const { limite, itens } = await this.service.exportar(filtroDaQuery(q));
    if (itens.length > limite) {
      throw new HttpException({ error: `A exportação passa de ${limite} linhas. Refine o filtro.` }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return { itens };
  }
}
