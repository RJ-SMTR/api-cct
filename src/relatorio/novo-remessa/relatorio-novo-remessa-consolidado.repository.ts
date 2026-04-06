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
import {
  buildBaseQuery,
  buildEleicaoQuery,
  buildPendentesQuery,
  buildPendenciaPagaSingleDateQuery,
} from './queries/novo-remessa-query-builder';

import { StatusPagamento } from '../enum/statusRemessafinancial-movement';

type NormalizedFilter = IFindPublicacaoRelatorioNovoRemessa & {
  dataInicio: Date;
  dataFim: Date;
};

@Injectable()
export class RelatorioNovoRemessaConsolidadoRepository {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaConsolidadoRepository.name, { timestamp: true });

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
    const groupedQueries = this.buildGroupedQueries(safeFilter, selectedStatuses);

    const unionData = this.buildUnionQuery(groupedQueries);
    const result = unionData
      ? await queryRunner.query(
        `
          SELECT nome, "cpfCnpj", SUM(valor) AS valor
          FROM (
            ${unionData.query}
          ) u
          GROUP BY nome, "cpfCnpj"
        `,
        unionData.params,
      )
      : [];
    const count = result.length;
    const total = unionData
      ? Number(
        (
          await queryRunner.query(
            `
              SELECT COALESCE(SUM(valor), 0) AS total
              FROM (
                ${unionData.query}
              ) t
            `,
            unionData.params,
          )
        )?.[0]?.total ?? 0,
      )
      : 0;
    const valorAPagar = selectedStatuses?.includes(StatusPagamento.A_PAGAR)
      ? await this.getTotalPorStatus(queryRunner, safeFilter, [StatusPagamento.A_PAGAR])
      : 0;

    const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();

    relatorioConsolidadoDto.valor = parseFloat(String(total.toFixed(2)));
    relatorioConsolidadoDto.valorAPagar = parseFloat(String(valorAPagar.toFixed(2)));

    relatorioConsolidadoDto.count = count;

    if ((safeFilter.userIds && safeFilter.userIds.length > 0) || safeFilter.todosVanzeiros) {
      const valorPorUsuario: Record<string, { nome: string; cpfCnpj: string | null; valor: number }> = {};

      for (const row of result) {
        const nome = row.nome;
        const cpfCnpj = row.cpfCnpj ?? null;
        const valor = parseFloat(String(row.valor));
        const key = `${nome}||${cpfCnpj ?? ''}`;

        if (!valorPorUsuario[key]) {
          valorPorUsuario[key] = { nome, cpfCnpj, valor: 0 };
        }

        valorPorUsuario[key].valor += valor;
      }

      relatorioConsolidadoDto.data = Object.values(valorPorUsuario).map((item) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = item.nome;
        elem.cpfCnpj = item.cpfCnpj;
        elem.valor = parseFloat(item.valor.toFixed(2));
        return elem;
      });
    } else {
      relatorioConsolidadoDto.data = result.map((r) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = r.nome;
        elem.cpfCnpj = r.cpfCnpj ?? null;
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

  private buildConsolidadoPorNomeQuery(
    filter: NormalizedFilter,
    nomeField: 'nomes' | '"nomeConsorcio"',
    baseQueryOverride?: string,
  ) {
    const baseQuery = baseQueryOverride ?? this.buildBaseQuery(filter);
    const includeCpf = nomeField === 'nomes';
    const cpfSelect = includeCpf ? '"cpfCnpj"' : 'NULL::text';
    const groupByClause = includeCpf ? `${nomeField}, "cpfCnpj"` : `${nomeField}`;
    return `
      SELECT ${nomeField} AS nome, ${cpfSelect} AS "cpfCnpj", SUM(valor) AS valor
      FROM (
        ${baseQuery}
      ) base
      GROUP BY ${groupByClause}
    `;
  }

  private buildBaseQuery(filter: NormalizedFilter): string {
    const baseQuery = buildBaseQuery({
      todosVanzeiros: filter.todosVanzeiros,
      consorcioFilterParamIndex: 5,
    });
    return baseQuery.trim();
  }

  private buildEleicaoQuery(filter: NormalizedFilter): string {
    const baseQuery = buildEleicaoQuery({
      todosVanzeiros: filter.todosVanzeiros,
      consorcioFilterParamIndex: 5,
    });
    return baseQuery.trim();
  }

  private buildPendenciaPagaSingleDateQuery(filter: NormalizedFilter): string {
    const baseQuery = buildPendenciaPagaSingleDateQuery({
      todosVanzeiros: filter.todosVanzeiros,
      consorcioFilterParamIndex: 5,
    });
    return baseQuery.trim();
  }

  private buildPendentesQuery(filter: NormalizedFilter, groupByConsorcio: boolean): string {
    const nomeSelect = groupByConsorcio ? `"nomeConsorcio"` : `nomes`;
    const cpfSelect = groupByConsorcio ? 'NULL::text' : `"cpfCnpj"`;
    const groupByClause = groupByConsorcio
      ? `\n    GROUP BY ${nomeSelect}`
      : `\n    GROUP BY ${nomeSelect}, ${cpfSelect}`;

    const pendentesBase = buildPendentesQuery({ todosVanzeiros: filter.todosVanzeiros }).trim();
    return `
    SELECT
      ${nomeSelect} AS nome,
      ${cpfSelect} AS "cpfCnpj",
      SUM(valor) AS valor
    FROM (
      ${pendentesBase}
    ) pendentes_base
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

  private isSingleDate(filter: NormalizedFilter): boolean {
    return format(filter.dataInicio, 'yyyy-MM-dd') === format(filter.dataFim, 'yyyy-MM-dd');
  }

  private getStatusParaFiltro(filter: NormalizedFilter): string[] | null {
    const statuses: string[] = [];

    const mapping: { cond?: boolean; vals: StatusPagamento[] }[] = [
      { cond: filter.pago, vals: [StatusPagamento.PAGO] },
      { cond: filter.erro, vals: [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO, StatusPagamento.PENDENTES] },
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

  private buildUnionQuery(
    groupedQueries: Array<{ query: string; params: any[] }>,
  ): { query: string; params: any[] } | null {
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

    return { query: unionQuery, params };
  }

  private shiftPlaceholders(query: string, offset: number) {
    if (offset === 0) return query;
    return query.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
  }

  private buildGroupedQueries(
    filter: NormalizedFilter,
    selectedStatuses: string[] | null,
  ): Array<{ query: string; params: any[] }> {
    if (filter.eleicao) {
      const groupedQueries: Array<{ query: string; params: any[] }> = [];
      const includeVanzeiros = Boolean(filter.todosVanzeiros || (filter.userIds && filter.userIds.length > 0));
      const includeConsorcios = Boolean(filter.todosConsorcios || (filter.consorcioNome && filter.consorcioNome.length > 0));
      const baseQuery = this.buildEleicaoQuery(filter);

      if (includeVanzeiros) {
        const consorcioOverride = filter.userIds && filter.userIds.length > 0
          ? null
          : this.PENDENTES_CONSORCIOS;
        const params = this.getQueryParameters(
          { ...filter, consorcioNome: consorcioOverride ?? filter.consorcioNome },
          selectedStatuses,
          consorcioOverride,
        );
        const sqlModais = this.buildConsolidadoPorNomeQuery(filter, 'nomes', baseQuery);
        groupedQueries.push({ query: sqlModais, params });
      }

      if (includeConsorcios) {
        const consorcioOverride = filter.todosConsorcios ? this.TODOS_CONSORCIOS : filter.consorcioNome;
        const params = this.getQueryParameters(
          { ...filter, userIds: undefined },
          selectedStatuses,
          consorcioOverride,
        );
        const sqlConsorcios = this.buildConsolidadoPorNomeQuery(filter, '"nomeConsorcio"', baseQuery);
        groupedQueries.push({ query: sqlConsorcios, params });
      }

      return groupedQueries;
    }

    const includePendenciaPagaSingleDate = this.isSingleDate(filter)
      && Boolean(selectedStatuses?.includes(StatusPagamento.PENDENCIA_PAGA));
    const baseStatuses = includePendenciaPagaSingleDate
      ? selectedStatuses?.filter((status) => status !== StatusPagamento.PENDENCIA_PAGA) ?? null
      : selectedStatuses;
    const includeBase = baseStatuses === null ? !includePendenciaPagaSingleDate : baseStatuses.length > 0;
    const includePendentes = Boolean(
      filter.pendentes || selectedStatuses?.includes(StatusPagamento.PENDENTES),
    );

    const includeVanzeiros = Boolean(filter.todosVanzeiros || (filter.userIds && filter.userIds.length > 0));
    const includeConsorcios = Boolean(filter.todosConsorcios || (filter.consorcioNome && filter.consorcioNome.length > 0));
    const groupedQueries: Array<{ query: string; params: any[] }> = [];

    if (filter.todosVanzeiros || (filter.userIds && filter.userIds.length > 0)) {
      const consorcioOverride = filter.userIds && filter.userIds.length > 0
        ? null
        : this.PENDENTES_CONSORCIOS;
      if (includeBase) {
        const params = this.getQueryParameters(
          { ...filter, consorcioNome: consorcioOverride ?? filter.consorcioNome },
          baseStatuses,
          consorcioOverride,
        );
        const sqlModais = this.buildConsolidadoPorNomeQuery(filter, 'nomes');
        groupedQueries.push({ query: sqlModais, params });
      }
      if (includePendenciaPagaSingleDate) {
        const pendenciaParams = this.getQueryParameters(
          { ...filter, consorcioNome: consorcioOverride ?? filter.consorcioNome },
          [StatusPagamento.PENDENCIA_PAGA],
          consorcioOverride,
        );
        const pendenciaBase = this.buildPendenciaPagaSingleDateQuery(filter);
        const sqlPendencia = this.buildConsolidadoPorNomeQuery(filter, 'nomes', pendenciaBase);
        groupedQueries.push({ query: sqlPendencia, params: pendenciaParams });
      }
    }

    if (filter.todosConsorcios || (filter.consorcioNome && filter.consorcioNome.length > 0)) {
      const consorcioOverride = filter.todosConsorcios ? this.TODOS_CONSORCIOS : filter.consorcioNome;
      if (includeBase) {
        const params = this.getQueryParameters(
          { ...filter, userIds: undefined },
          baseStatuses,
          consorcioOverride,
        );
        const sqlConsorcios = this.buildConsolidadoPorNomeQuery(filter, '"nomeConsorcio"');
        groupedQueries.push({ query: sqlConsorcios, params });
      }
      if (includePendenciaPagaSingleDate) {
        const pendenciaParams = this.getQueryParameters(
          { ...filter, userIds: undefined },
          [StatusPagamento.PENDENCIA_PAGA],
          consorcioOverride,
        );
        const pendenciaBase = this.buildPendenciaPagaSingleDateQuery(filter);
        const sqlPendencia = this.buildConsolidadoPorNomeQuery(filter, '"nomeConsorcio"', pendenciaBase);
        groupedQueries.push({ query: sqlPendencia, params: pendenciaParams });
      }
    }

    if (includePendentes) {
      const pendentesParams = this.getQueryParameters(
        {
          ...filter,
          consorcioNome: filter.todosVanzeiros ? this.PENDENTES_CONSORCIOS : filter.consorcioNome,
        },
        selectedStatuses,
        filter.todosVanzeiros ? this.PENDENTES_CONSORCIOS : filter.consorcioNome,
      );
      const groupByConsorcio = includeConsorcios && !includeVanzeiros;
      const pendentesQuery = this.buildPendentesQuery(filter, groupByConsorcio);
      groupedQueries.push({ query: pendentesQuery, params: pendentesParams });
    }

    return groupedQueries;
  }

  private async getTotalPorStatus(
    queryRunner: QueryRunner,
    filter: NormalizedFilter,
    selectedStatuses: string[],
  ): Promise<number> {
    const groupedQueries = this.buildGroupedQueries(filter, selectedStatuses);
    const unionData = this.buildUnionQuery(groupedQueries);
    if (!unionData) return 0;

    const result = await queryRunner.query(
      `
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM (
          ${unionData.query}
        ) t
      `,
      unionData.params,
    );

    return Number(result?.[0]?.total ?? 0);
  }
}
