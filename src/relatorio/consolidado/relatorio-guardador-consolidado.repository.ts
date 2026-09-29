import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { format } from 'date-fns';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioConsolidadoDto } from '../dtos/relatorio-consolidado.dto';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { IFindPublicacaoRelatorio } from '../interfaces/find-publicacao-relatorio.interface';
import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import {
  buildGuardadorBaseQuery,
  buildGuardadorAPagarQuery,
  buildGuardadorPendenciaPagaSingleDateQuery,
} from '../novo-remessa/queries/guardador-novo-remessa-query-builder';

type ResolvedStatuses = {
  baseStatuses: string[] | null;
  includeAPagar: boolean;
  includeBase: boolean;
  includePendenciaPagaSingleDate: boolean;
};

@Injectable()
export class RelatorioGuardadorConsolidadoRepository {
  private readonly logger = new CustomLogger(
    RelatorioGuardadorConsolidadoRepository.name,
    { timestamp: true },
  );

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  public async findConsolidado(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoDto[]> {
    const dataInicioStr = format(new Date(args.dataInicio), 'yyyy-MM-dd');
    const dataFimStr = format(new Date(args.dataFim), 'yyyy-MM-dd');
    const isSingleDate = dataInicioStr === dataFimStr;

    const selectedStatuses = this.getSelectedStatuses(args);
    const statuses = this.resolveStatuses(selectedStatuses, isSingleDate);

    const rawConsorcio = args.consorcioNome;
    const consorcioList: string[] = Array.isArray(rawConsorcio)
      ? rawConsorcio
      : typeof rawConsorcio === 'string'
      ? (rawConsorcio as string).split(',').map((s) => s.trim())
      : [];

    const hasTodosConsorcios =
      args.todosConsorcios === true ||
      (args as any).todosConsorcios === 'true' ||
      consorcioList.some((c) => typeof c === 'string' && c.trim().toLowerCase() === 'todos');

    const consorcioNome = !hasTodosConsorcios && consorcioList.length
      ? consorcioList
          .map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : ''))
          .filter(Boolean)
      : null;

    const rawFavorecido = args.favorecidoNome;
    const favorecidoList: string[] = Array.isArray(rawFavorecido)
      ? rawFavorecido
      : typeof rawFavorecido === 'string'
      ? (rawFavorecido as string).split(',').map((s) => s.trim())
      : [];

    const favorecidoNome =
      favorecidoList.length &&
      !favorecidoList.some((f) => typeof f === 'string' && f.trim().toLowerCase() === 'todos')
        ? favorecidoList
            .map((f) => (typeof f === 'string' ? f.trim().toUpperCase() : ''))
            .filter(Boolean)
        : null;

    const userIds = (args as any).userIds?.length ? (args as any).userIds : null;

    const params: any[] = [
      dataInicioStr,
      dataFimStr,
      userIds,
      statuses.baseStatuses,
      consorcioNome,
      args.valorMin !== undefined ? args.valorMin : null,
      args.valorMax !== undefined ? args.valorMax : null,
      favorecidoNome,
    ];

    const finalBaseQuery = this.buildFinalBaseQuery(statuses, hasTodosConsorcios);

    const finalQuery = `
      SELECT
        nomes AS nome,
        ROUND(SUM(valor)::numeric, 2) AS valor
      FROM (
        ${finalBaseQuery}
      ) base
      GROUP BY nomes
      ORDER BY nomes ASC
    `;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      this.logger.debug(`[Consolidado Guardador] Executando query: ${finalQuery}`);
      const rows: any[] = await queryRunner.query(finalQuery, params);
      return rows.map((r) => new RelatorioConsolidadoDto({
        nome: r.nome,
        valor: parseFloat(r.valor),
      }));
    } catch (error) {
      this.logger.error('[Consolidado Guardador] Erro ao executar query', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  public async findConsolidadoNovoRemessa(
    args: IFindPublicacaoRelatorioNovoRemessa,
  ): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const list = await this.findConsolidado({
      dataInicio: args.dataInicio,
      dataFim: args.dataFim,
      userIds: args.userIds,
      consorcioNome: args.consorcioNome,
      todosConsorcios: args.todosConsorcios,
      valorMin: args.valorMin,
      valorMax: args.valorMax,
      pago: args.pago,
      aPagar: args.aPagar,
      emProcessamento: args.emProcessamento,
      rejeitado: args.rejeitado,
      estorno: args.estorno,
      pendenciaPaga: args.pendenciaPaga,
    } as any);

    const mappedResults = list.map((item) => {
      const elem = new RelatorioConsolidadoNovoRemessaData();
      elem.nomefavorecido = String(item.nome);
      elem.valor = item.valor;
      return elem;
    });

    return new RelatorioConsolidadoNovoRemessaDto({
      data: mappedResults,
      count: mappedResults.length,
      valor: mappedResults.reduce((acc, curr) => acc + curr.valor, 0),
    });
  }

  private getSelectedStatuses(args: IFindPublicacaoRelatorio): string[] {
    const requestedStatus = args.status;
    const statusSet = new Set<string>();

    const hasSpecificFlags =
      args.pago !== undefined ||
      args.aPagar !== undefined ||
      args.emProcessamento !== undefined ||
      args.rejeitado !== undefined ||
      args.estorno !== undefined ||
      args.pendenciaPaga !== undefined;

    if (requestedStatus && !hasSpecificFlags) {
      if (requestedStatus === 'pago') {
        statusSet.add(StatusPagamento.PAGO);
      } else if (requestedStatus === 'aPagar') {
        statusSet.add(StatusPagamento.A_PAGAR);
      } else if (requestedStatus === 'erros') {
        statusSet.add(StatusPagamento.ERRO_ESTORNO);
        statusSet.add(StatusPagamento.ERRO_REJEITADO);
      }
      // 'todos' -> empty set (means all statuses)
    } else {
      if (args.pago === true) {
        statusSet.add(StatusPagamento.PAGO);
      }
      if (args.pago === false) {
        statusSet.add(StatusPagamento.ERRO_ESTORNO);
        statusSet.add(StatusPagamento.ERRO_REJEITADO);
      }
      if (args.aPagar === true) {
        statusSet.add(StatusPagamento.A_PAGAR);
      }
      if (args.emProcessamento === true) {
        statusSet.add(StatusPagamento.AGUARDANDO_PAGAMENTO);
      }
      if (args.rejeitado === true) {
        statusSet.add(StatusPagamento.ERRO_REJEITADO);
      }
      if (args.estorno === true) {
        statusSet.add(StatusPagamento.ERRO_ESTORNO);
      }
      if (args.pendenciaPaga === true) {
        statusSet.add(StatusPagamento.PENDENCIA_PAGA);
      }
    }

    return Array.from(statusSet);
  }

  private resolveStatuses(
    selectedStatuses: string[],
    isSingleDate: boolean,
  ): ResolvedStatuses {
    if (!selectedStatuses.length) {
      return {
        baseStatuses: null,
        includeAPagar: true,
        includeBase: true,
        includePendenciaPagaSingleDate: false,
      };
    }

    const includeAPagar = selectedStatuses.includes(StatusPagamento.A_PAGAR);
    const includePendenciaPagaSingleDate = isSingleDate
      && selectedStatuses.includes(StatusPagamento.PENDENCIA_PAGA);
    const baseStatuses = selectedStatuses.filter((status) =>
      !includePendenciaPagaSingleDate || status !== StatusPagamento.PENDENCIA_PAGA,
    );

    return {
      baseStatuses: baseStatuses.length ? baseStatuses : null,
      includeAPagar,
      includeBase: baseStatuses.length > 0,
      includePendenciaPagaSingleDate,
    };
  }

  private buildFinalBaseQuery(statuses: ResolvedStatuses, todosConsorcios?: boolean): string {
    const queries: string[] = [];

    if (statuses.includeBase) {
      queries.push(buildGuardadorBaseQuery({
        consorcioFilterParamIndex: 5,
        favorecidoFilterParamIndex: 8,
        todosConsorcios,
      }));
    }

    if (statuses.includePendenciaPagaSingleDate) {
      queries.push(buildGuardadorPendenciaPagaSingleDateQuery({
        consorcioFilterParamIndex: 5,
        favorecidoFilterParamIndex: 8,
        todosConsorcios,
      }));
    }

    if (statuses.includeAPagar) {
      queries.push(buildGuardadorAPagarQuery({
        consorcioFilterParamIndex: 5,
        favorecidoFilterParamIndex: 8,
        todosConsorcios,
      }));
    }

    if (!queries.length) {
      return buildGuardadorBaseQuery({
        consorcioFilterParamIndex: 5,
        favorecidoFilterParamIndex: 8,
        todosConsorcios,
      });
    }

    return queries.join('\nUNION ALL\n');
  }
}
