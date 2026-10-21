import { Body, Controller, Get, HttpException, HttpStatus, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditoriaAcessoGuard } from './auditoria-acesso.guard';
import { AuditoriaService, paginar } from './auditoria.service';
import { ReconciliacaoService } from './reconciliacao.service';

const numero = (valor?: string) => (valor === undefined || valor === '' ? undefined : Number(valor));

/** Área de auditoria: restrita (AuditoriaAcessoGuard) aos usuários liberados, por padrão só o id 45. */
@Controller({ path: 'auditoria', version: '1' })
@UseGuards(AuthGuard('jwt'), AuditoriaAcessoGuard)
export class AuditoriaController {
  constructor(
    private readonly service: AuditoriaService,
    private readonly reconciliacaoService: ReconciliacaoService,
  ) {}

  @Get('execucoes')
  execucoes(@Query() q: Record<string, string>) {
    return this.service.execucoes({ origem: q.origem, status: q.status }, paginar(q.page, q.pageSize));
  }

  @Get('execucoes/:id')
  execucao(@Param('id', ParseIntPipe) id: number) {
    return this.service.execucao(id);
  }

  @Get('ordens')
  ordens(@Query() q: Record<string, string>) {
    return this.service.ordens(
      { acao: q.acao, bqId: numero(q.bqId), ordemId: numero(q.ordemId), execucaoId: numero(q.execucaoId), dataInicio: q.dataInicio, dataFim: q.dataFim },
      paginar(q.page, q.pageSize),
    );
  }

  @Get('quarentena')
  quarentena(@Query() q: Record<string, string>) {
    return this.service.quarentena({ status: q.status, bqId: numero(q.bqId) }, paginar(q.page, q.pageSize));
  }

  @Post('quarentena/:id/aprovar')
  aprovar(@Param('id', ParseIntPipe) id: number, @Body() body: { observacao?: string }, @Req() req: any) {
    return this.service.revisarQuarentena(id, 'aprovar', Number(req.user.id), body?.observacao);
  }

  @Post('quarentena/:id/rejeitar')
  rejeitar(@Param('id', ParseIntPipe) id: number, @Body() body: { observacao?: string }, @Req() req: any) {
    if (!body?.observacao?.trim()) {
      throw new HttpException({ error: 'Informe o motivo da rejeição.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return this.service.revisarQuarentena(id, 'rejeitar', Number(req.user.id), body.observacao);
  }

  @Get('reconciliacao')
  reconciliacao(@Query() q: Record<string, string>) {
    return this.service.reconciliacao(
      { dataInicio: q.dataInicio, dataFim: q.dataFim, somenteDivergentes: q.somenteDivergentes === 'true' },
      paginar(q.page, q.pageSize),
    );
  }

  /** Recalcula só o lado do banco (BigQuery fica como na última sincronização) para os dias informados. */
  @Post('reconciliacao/recalcular')
  recalcular(@Body() body: { dataInicio: string; dataFim: string }) {
    return this.reconciliacaoService.recalcularBanco(body?.dataInicio, body?.dataFim);
  }

  @Get('guarda')
  guarda(@Query() q: Record<string, string>) {
    const desde = q.desde && /^\d{4}-\d{2}-\d{2}$/.test(q.desde) ? q.desde : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    return this.service.guarda(desde, paginar(q.page, q.pageSize));
  }

  @Get('sistema/tabelas')
  tabelas() {
    return this.service.tabelasAuditadas();
  }

  @Get('sistema')
  sistema(@Query() q: Record<string, string>) {
    return this.service.sistema(
      {
        tabela: q.tabela,
        operacao: q.operacao,
        registroId: q.registroId,
        usuarioId: numero(q.usuarioId),
        dataInicio: q.dataInicio,
        dataFim: q.dataFim,
        texto: q.texto,
      },
      paginar(q.page, q.pageSize),
    );
  }

  @Get('requisicoes')
  requisicoes(@Query() q: Record<string, string>) {
    return this.service.requisicoes(
      { usuarioId: numero(q.usuarioId), metodo: q.metodo, rota: q.rota, dataInicio: q.dataInicio, dataFim: q.dataFim },
      paginar(q.page, q.pageSize),
    );
  }
}
