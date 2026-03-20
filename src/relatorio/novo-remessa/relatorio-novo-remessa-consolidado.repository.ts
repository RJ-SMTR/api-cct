import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { format } from 'date-fns';
import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';

type NormalizedFilter = IFindPublicacaoRelatorioNovoRemessa & {
  dataInicio: Date;
  dataFim: Date;
};

@Injectable()
export class RelatorioNovoRemessaConsolidadoRepository {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaConsolidadoRepository.name, { timestamp: true });

  private readonly CONSORCIO_CASE = `
    CASE
      WHEN pu."permitCode" = '8' THEN 'VLT'
      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
      ELSE op."nomeConsorcio"
    END
  `;

  private readonly STATUS_CASE = `
    CASE
      WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
      WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
      WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
      WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
      WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
      ELSE 'Rejeitado'
    END
  `;

  private readonly PENDENTES_CONSORCIOS = ['STPC', 'STPL', 'TEC'];
  private readonly TODOS_CONSORCIOS = [
    'STPC',
    'STPL',
    'VLT',
    'Santa Cruz',
    'Internorte',
    'Intersul',
    'Transcarioca',
    'MobiRio',
    'TEC',
    'MOBI-Rio BUM',
  ];

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    const safeFilter = this.normalizeFilter(filter);
    const selectedStatuses = this.getStatusParaFiltro(safeFilter);

    let totalBase = 0;
    const includeVanzeiros = Boolean(safeFilter.todosVanzeiros || (safeFilter.userIds && safeFilter.userIds.length > 0));
    const includeConsorcios = Boolean(safeFilter.todosConsorcios || (safeFilter.consorcioNome && safeFilter.consorcioNome.length > 0));
    const groupedQueries: Array<{ query: string; params: any[] }> = [];

    if (safeFilter.todosVanzeiros || (safeFilter.userIds && safeFilter.userIds.length > 0)) {
      const consorcioOverride = safeFilter.userIds && safeFilter.userIds.length > 0
        ? null
        : this.PENDENTES_CONSORCIOS;
      const params = this.getQueryParameters(
        { ...safeFilter, consorcioNome: consorcioOverride ?? safeFilter.consorcioNome },
        selectedStatuses,
        consorcioOverride,
      );
      const sqlModais = this.applyValorFilterToQuery(
        this.buildConsolidadoPorNomeQuery(safeFilter, 'nomes'),
        safeFilter,
      );
      const totalModais = await this.fetchTotal(sqlModais, params, safeFilter, queryRunner, false);
      totalBase += totalModais;
      groupedQueries.push({ query: sqlModais, params });
    }

    if (safeFilter.todosConsorcios || (safeFilter.consorcioNome && safeFilter.consorcioNome.length > 0)) {
      const consorcioOverride = safeFilter.todosConsorcios ? this.TODOS_CONSORCIOS : safeFilter.consorcioNome;
      const params = this.getQueryParameters(
        { ...safeFilter, userIds: undefined },
        selectedStatuses,
        consorcioOverride,
      );
      const sqlConsorcios = this.applyValorFilterToQuery(
        this.buildConsolidadoPorNomeQuery(safeFilter, '"nomeConsorcio"'),
        safeFilter,
      );
      const totalConsorcios = await this.fetchTotal(sqlConsorcios, params, safeFilter, queryRunner, false);
      totalBase += totalConsorcios;
      groupedQueries.push({ query: sqlConsorcios, params });
    }

    let totalPendentes = 0;
    if (safeFilter.pendentes) {
      const pendentesParams = this.getQueryParameters(
        {
          ...safeFilter,
          consorcioNome: safeFilter.todosVanzeiros ? this.PENDENTES_CONSORCIOS : safeFilter.consorcioNome,
        },
        selectedStatuses,
        safeFilter.todosVanzeiros ? this.PENDENTES_CONSORCIOS : safeFilter.consorcioNome,
      );
      const groupByConsorcio = includeConsorcios && !includeVanzeiros;
      const pendentesQuery = this.buildPendentesQuery(safeFilter, groupByConsorcio);
      totalPendentes = await this.fetchTotal(pendentesQuery, pendentesParams, safeFilter, queryRunner, false);
      groupedQueries.push({ query: pendentesQuery, params: pendentesParams });
    }

    const result = await this.loadGroupedResults(groupedQueries, queryRunner) ?? [];
    const count = result.length;

    const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();

    if (safeFilter.aPagar !== undefined || safeFilter.emProcessamento !== undefined) {
      relatorioConsolidadoDto.valor = parseFloat(String(totalBase.toFixed(2)));
    } else if (safeFilter.pago !== undefined || safeFilter.erro !== undefined) {
      relatorioConsolidadoDto.valor = parseFloat(String((totalBase + totalPendentes).toFixed(2)));
    } else {
      relatorioConsolidadoDto.valor = parseFloat(String(totalBase.toFixed(2)));
    }

    relatorioConsolidadoDto.count = count;

    if ((safeFilter.userIds && safeFilter.userIds.length > 0) || safeFilter.todosVanzeiros) {
      const valorPorUsuario: Record<string, number> = {};

      for (const row of result) {
        const nome = row.nome;
        const valor = parseFloat(String(row.valor));

        if (!valorPorUsuario[nome]) {
          valorPorUsuario[nome] = 0;
        }

        valorPorUsuario[nome] += valor;
      }

      relatorioConsolidadoDto.data = Object.entries(valorPorUsuario).map(([nome, valor]: [string, number]) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = nome;
        elem.valor = parseFloat(valor.toFixed(2));
        return elem;
      });
    } else {
      relatorioConsolidadoDto.data = result.map((r) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = r.nome;
        elem.valor = parseFloat(String(r.valor));
        return elem;
      });
    }

    await queryRunner.release();
    return relatorioConsolidadoDto;
  }

  public async obterTotalConsorciosEModais(
    filter: IFindPublicacaoRelatorioNovoRemessa,
    queryRunner: QueryRunner,
  ) {
    const safeFilter = this.normalizeFilter(filter);
    const selectedStatuses = this.getStatusParaFiltro(safeFilter);
    const consorcioOverride = safeFilter.todosConsorcios ? this.TODOS_CONSORCIOS : safeFilter.consorcioNome;

    const params = this.getQueryParameters(
      { ...safeFilter, userIds: undefined },
      selectedStatuses,
      consorcioOverride,
    );
    const sqlConsorcios = this.buildConsolidadoPorNomeQuery(safeFilter, '"nomeConsorcio"');
    const resultConsolidadoModais = await queryRunner.query(sqlConsorcios, params);

    const mapModaisEConsorcios = resultConsolidadoModais.reduce((acc, curr) => {
      acc[curr.nome] = parseFloat(curr.valor);
      return acc;
    }, {});
    return mapModaisEConsorcios;
  }

  private buildConsolidadoPorNomeQuery(filter: NormalizedFilter, nomeField: 'nomes' | '"nomeConsorcio"') {
    const baseQuery = this.buildBaseQuery(filter);
    return `
      SELECT ${nomeField} AS nome, SUM(valor) AS valor
      FROM (
        ${baseQuery}
      ) base
      GROUP BY ${nomeField}
    `;
  }

  private buildBaseQuery(filter: NormalizedFilter): string {
    return `
      SELECT DISTINCT
        da."dataVencimento" AS "dataReferencia",
        pu."fullName" AS nomes,
        ${this.CONSORCIO_CASE} AS "nomeConsorcio",
        da."valorLancamento" AS valor,
        ${this.STATUS_CASE} AS status
      FROM ordem_pagamento op
      INNER JOIN ordem_pagamento_agrupado opa
        ON op."ordemPagamentoAgrupadoId" = opa.id
      LEFT JOIN ordem_pagamento_agrupado op_pai
        ON op_pai.id = opa."ordemPagamentoAgrupadoId"
      INNER JOIN ordem_pagamento_agrupado_historico oph
        ON oph."ordemPagamentoAgrupadoId" = opa.id
      INNER JOIN detalhe_a da
        ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
      INNER JOIN public."user" pu
        ON pu.id = op."userId"
      INNER JOIN bank bc
        ON bc.code = pu."bankCode"
      WHERE
        da."dataVencimento" BETWEEN $1 AND $2
        AND ($3::integer[] IS NULL OR pu.id = ANY($3))
        AND ($4::text[] IS NULL OR ${this.STATUS_CASE} = ANY($4))
        AND ($5::text[] IS NULL OR UPPER(TRIM(${this.CONSORCIO_CASE})) = ANY($5))
        AND (
          ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric)
          AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ordem_pagamento_agrupado filha
          WHERE filha."ordemPagamentoAgrupadoId" = opa.id
        )
        AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
        ${this.buildDesativadosCondition(filter, 'pu')}
    `;
  }

  private buildPendentesQuery(filter: NormalizedFilter, groupByConsorcio: boolean): string {
    const nomeSelect = groupByConsorcio ? this.CONSORCIO_CASE : `op."nomeOperadora"`;
    const groupByClause = `\n    GROUP BY ${nomeSelect}`;

    return `
    SELECT
      ${nomeSelect} AS nome,
      SUM(op.valor) AS valor
    FROM ordem_pagamento op
    INNER JOIN public."user" pu
      ON pu.id = op."userId"
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      op."dataOrdem" BETWEEN $1 AND $2
      AND op."ordemPagamentoAgrupadoId" IS NULL
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND UPPER(TRIM(${this.CONSORCIO_CASE})) = ANY(
        COALESCE(NULLIF($5::text[], '{}'), ARRAY['STPC','STPL','TEC'])
      )
      AND (
        ($6::numeric IS NULL OR op.valor >= $6::numeric)
        AND ($7::numeric IS NULL OR op.valor <= $7::numeric)
      )
      ${this.buildDesativadosCondition(filter, 'pu')}
    ${groupByClause}
  `;
  }

  private normalizeFilter(filter: IFindPublicacaoRelatorioNovoRemessa): NormalizedFilter {
    return {
      ...filter,
      dataInicio: new Date(filter.dataInicio),
      dataFim: new Date(filter.dataFim),
      consorcioNome: filter.consorcioNome?.length
        ? filter.consorcioNome.map((nome) => nome.toUpperCase().trim())
        : undefined,
    };
  }

  private getStatusParaFiltro(filter: NormalizedFilter): string[] | null {
    const statuses: string[] = [];

    const mapping: { cond?: boolean; vals: StatusPagamento[] }[] = [
      { cond: filter.pago, vals: [StatusPagamento.PAGO] },
      { cond: filter.erro, vals: [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO] },
      { cond: filter.estorno, vals: [StatusPagamento.ERRO_ESTORNO] },
      { cond: filter.rejeitado, vals: [StatusPagamento.ERRO_REJEITADO] },
      { cond: filter.emProcessamento, vals: [StatusPagamento.AGUARDANDO_PAGAMENTO] },
      { cond: filter.pendenciaPaga, vals: [StatusPagamento.PENDENCIA_PAGA] },
      { cond: filter.aPagar, vals: [StatusPagamento.A_PAGAR] },
    ];

    for (const item of mapping) {
      if (item.cond) statuses.push(...item.vals);
    }

    return statuses.length ? [...new Set(statuses)] : null;
  }

  private getQueryParameters(
    filter: NormalizedFilter,
    selectedStatuses: string[] | null,
    consorcioOverride?: string[] | null,
  ): any[] {
    const consorcioNome = consorcioOverride?.length
      ? consorcioOverride.map((nome) => nome.toUpperCase().trim())
      : filter.consorcioNome?.length
        ? filter.consorcioNome.map((nome) => nome.toUpperCase().trim())
        : null;

    return [
      format(filter.dataInicio, 'yyyy-MM-dd'),
      format(filter.dataFim, 'yyyy-MM-dd'),
      filter.userIds?.length ? filter.userIds : null,
      selectedStatuses,
      consorcioNome,
      filter.valorMin ?? null,
      filter.valorMax ?? null,
    ];
  }

  private buildDesativadosCondition(filter: NormalizedFilter, alias: string): string {
    const ativo = filter.desativados ? 'true' : 'false';
    return `AND ${alias}.bloqueado = ${ativo}`;
  }

  private applyValorFilterToQuery(query: string, filter: NormalizedFilter) {
    if (filter.valorMin === undefined && filter.valorMax === undefined) {
      return query;
    }

    return `
      SELECT *
      FROM (
        ${query}
      ) vv
      WHERE
        ($6::numeric IS NULL OR vv.valor >= $6::numeric)
        AND ($7::numeric IS NULL OR vv.valor <= $7::numeric)
    `;
  }

  private async fetchTotal(
    query: string,
    params: any[],
    filter: NormalizedFilter,
    queryRunner: QueryRunner,
    applyValorFilter = true,
  ) {
    const filteredQuery = applyValorFilter ? this.applyValorFilterToQuery(query, filter) : query;
    const totalQuery = `
      SELECT COALESCE(SUM(valor), 0) AS total
      FROM (
        ${filteredQuery}
      ) t
    `;
    const result = await queryRunner.query(totalQuery, params);
    return Number(result?.[0]?.total ?? 0);
  }

  private async loadGroupedResults(
    groupedQueries: Array<{ query: string; params: any[] }>,
    queryRunner: QueryRunner,
  ) {
    if (!groupedQueries.length) return null;

    let offset = 0;
    const params: any[] = [];
    const parts = groupedQueries.map(({ query, params: queryParams }) => {
      const shifted = this.shiftPlaceholders(query, offset);
      params.push(...queryParams);
      offset += queryParams.length;
      return shifted;
    });

    const unionQuery = parts.length === 1
      ? parts[0]
      : parts.join('\nUNION ALL\n');

    const groupedQuery = `
      SELECT nome, SUM(valor) AS valor
      FROM (
        ${unionQuery}
      ) u
      GROUP BY nome
    `;
    return queryRunner.query(groupedQuery, params);
  }

  private shiftPlaceholders(query: string, offset: number) {
    if (offset === 0) return query;
    return query.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
  }
}
