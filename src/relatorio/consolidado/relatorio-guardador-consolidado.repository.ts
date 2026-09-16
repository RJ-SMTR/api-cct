import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioConsolidadoDto } from '../dtos/relatorio-consolidado.dto';
import { IFindPublicacaoRelatorio } from '../interfaces/find-publicacao-relatorio.interface';

type StatusFiltro = {
  pago?: boolean;
  emProcessamento?: boolean;
  rejeitado?: boolean;
  estornado?: boolean;
  pendenciaPaga?: boolean;
}

@Injectable()
export class RelatorioGuardadorConsolidadoRepository {
  private logger = new CustomLogger(RelatorioGuardadorConsolidadoRepository.name, { timestamp: true });
  constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

  private ASSOC_NOMES = [
    'ASSOCIACAO NACIONAL DOS GUARDADORES E LAVADORES DE AUTOMOVEIS CONGENERES E AFINS',
    'SINDICATO DOS GUARDADORES DE AUTOMOVEIS NO ESTADO DO RIO DE JANEIRO E REGIAO - SINGAERJ'
  ];

  private buildStatusClause(status: StatusFiltro, params: any[], startIdx: number) {
    let clause = '';
    let idx = startIdx;
    if (status.emProcessamento === true) {
      clause += ` AND oph."statusRemessa" = $${idx++}`;
      params.push(2);
    } else if (status.pendenciaPaga === true) {
      clause += ` AND oph."statusRemessa" = $${idx++}`;
      params.push(5);
    } else if (status.pago === true) {
      clause += ` AND oph."statusRemessa" = $${idx++}`;
      params.push(3);
    } else if (status.estornado === true) {
      clause += ` AND  oph."statusRemessa" = 4 AND oph."motivoStatusRemessa" = $${idx++}`;
      params.push('02');
    } else if (status.rejeitado === true) {
      clause += ` AND oph."statusRemessa" = 4 AND oph."motivoStatusRemessa" = ANY($${idx++}::text[])`;
      params.push(['AL', 'ANHO']);
    } else if (status.pago === false) {
      clause += ` AND oph."statusRemessa" = $${idx++}`;
      params.push(4);
    }
    return { clause, nextIdx: idx };
  }

  private getQueryAPagar(dataInicio: string, dataFim: string, isAssociacao: boolean, opts: { valorMin?, valorMax?, nomes?: string[] }) {
  const params: any[] = [];
  let paramIdx = 1;

  let query = `
      SELECT uu."fullName" as nome, round(og."valorRepasseGuardador",2) as valor
      FROM ordem_pagamento_guardador og
      INNER JOIN public.user uu ON uu."id" = og."userId"
      WHERE uu."permitCode" IS ${isAssociacao ? 'NULL' : 'NOT NULL'}
      AND date_trunc('day', og."dataOrdem") BETWEEN $${paramIdx++}::date AND $${paramIdx++}::date
      AND og."ordemPagamentoAgrupadoId" is null
    `;
  params.push(dataInicio, dataFim);

  if (opts.nomes && opts.nomes.length > 0 && !opts.nomes.includes('Todos')) {
    const placeholders = opts.nomes.map(() => `$${paramIdx++}`).join(',');
    query += ` AND uu."fullName" IN (${placeholders})`;

    params.push(...opts.nomes);
  } else if (opts.nomes?.includes('Todos') || !opts.nomes) {
    // Se for "Todos" de guardadores, tem que excluir associações
    if (!isAssociacao) {
      const placeholders = this.ASSOC_NOMES.map(() => `$${paramIdx++}`).join(',');
      query += ` AND uu."fullName" NOT IN (${placeholders})`;
      params.push(...this.ASSOC_NOMES);
    } else {
      const placeholders = this.ASSOC_NOMES.map(() => `$${paramIdx++}`).join(',');
      query += ` AND uu."fullName" IN (${placeholders})`;
      params.push(...this.ASSOC_NOMES);
    }
  }

  if (opts.valorMin !== undefined) {
    query += ` AND round(og."valorRepasseGuardador",2) >= $${paramIdx++}`;
    params.push(opts.valorMin);
  }
  if (opts.valorMax !== undefined) {
    query += ` AND round(og."valorRepasseGuardador",2) <= $${paramIdx++}`;
    params.push(opts.valorMax);
  }

  return { query, params };
}

  private getQueryPago(dataInicio: string, dataFim: string, isAssociacao: boolean, status: StatusFiltro, opts: { valorMin?, valorMax?, nomes?: string[] }) {
  const params: any[] = [];
  let paramIdx = 1;

  let query = `
      SELECT uu."fullName" as nome, round(da."valorLancamento",2) as valor
      FROM ordem_pagamento_guardador og
      INNER JOIN public.user uu ON uu."id" = og."userId"
      INNER JOIN ordem_pagamento_agrupado opa ON opa."id" = og."ordemPagamentoAgrupadoId"
      INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa."id"
      INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
      WHERE uu."permitCode" IS ${isAssociacao ? 'NULL' : 'NOT NULL'}
      AND date_trunc('day', da."dataVencimento") BETWEEN $${paramIdx++}::date AND $${paramIdx++}::date
    `;
  params.push(dataInicio, dataFim);

  if (opts.nomes && opts.nomes.length > 0 && !opts.nomes.includes('Todos')) {
    const placeholders = opts.nomes.map(() => `$${paramIdx++}`).join(',');
    query += ` AND uu."fullName" IN (${placeholders})`;
    params.push(...opts.nomes);
  } else if (isAssociacao) {
    const placeholders = this.ASSOC_NOMES.map(() => `$${paramIdx++}`).join(',');
    if (opts.nomes?.includes('Todos')) {
      query += ` AND uu."fullName" IN (${placeholders})`;
      params.push(...this.ASSOC_NOMES);
    }
  } else {
    if (opts.nomes?.includes('Todos') || !opts.nomes) {
      const placeholders = this.ASSOC_NOMES.map(() => `$${paramIdx++}`).join(',');
      query += ` AND uu."fullName" NOT IN (${placeholders})`;
      params.push(...this.ASSOC_NOMES);
    }
  }

  const statusResult = this.buildStatusClause(status, params, paramIdx);
  query += statusResult.clause;
  paramIdx = statusResult.nextIdx; 

  return { query, params };
}

  public async findConsolidado(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoDto[]> {
    const dataInicio = args.dataInicio.toISOString().slice(0, 10);
    const dataFim = args.dataFim.toISOString().slice(0, 10);

    const queries: string[] = [];
    const allParams: any[] = [];
    let globalIdx = 1;

    const requestedStatus = (args as any).status;
    let pago = args.pago;
    let aPagar = args.aPagar;
    let emProcessamento = args.emProcessamento;
    let rejeitado = args.rejeitado;
    let estornado = args.estorno;
    let pendenciaPaga = (args as any).pendenciaPaga;

    if (requestedStatus && pago === undefined && aPagar === undefined && emProcessamento === undefined && pendenciaPaga === undefined) {
      if (requestedStatus === 'pago') {
        pago = true;
      } else if (requestedStatus === 'aPagar') {
        aPagar = true;
      } else if (requestedStatus === 'erros') {
        pago = false;
      }
    }

    const status: StatusFiltro = {
      pago,
      emProcessamento,
      rejeitado,
      estornado,
      pendenciaPaga,
    };

    const isAPagarOnly = aPagar === true;
    const isPagoOnly = (pago !== undefined || emProcessamento === true || rejeitado === true || estornado === true || pendenciaPaga === true) && aPagar !== true;
    const shouldIncludeAPagar = isAPagarOnly || !isPagoOnly;
    const shouldIncludePago = !isAPagarOnly;

    // Decide o que buscar
    const buscarAssociacao = args.favorecidoNome === undefined;
    const buscarGuardadores = args.consorcioNome === undefined || args.favorecidoNome !== undefined;

    if (buscarAssociacao) {
      if (shouldIncludeAPagar) {
        const resultAPagar = this.getQueryAPagar(dataInicio, dataFim, true, { valorMin: args.valorMin, valorMax: args.valorMax, nomes: args.consorcioNome });
        const reindexed = resultAPagar.query.replace(/\$\d+/g, () => `$${globalIdx++}`);
        queries.push(reindexed);
        allParams.push(...resultAPagar.params);
      }
      if (shouldIncludePago) {
        const resultPago = this.getQueryPago(dataInicio, dataFim, true, status, { valorMin: args.valorMin, valorMax: args.valorMax, nomes: args.consorcioNome });
        const reindexed = resultPago.query.replace(/\$\d+/g, () => `$${globalIdx++}`);
        queries.push(reindexed);
        allParams.push(...resultPago.params);
      }
    }

    if (buscarGuardadores) {
      if (shouldIncludeAPagar) {
        const resultAPagar = this.getQueryAPagar(dataInicio, dataFim, false, { valorMin: args.valorMin, valorMax: args.valorMax, nomes: args.favorecidoNome });
        const reindexed = resultAPagar.query.replace(/\$\d+/g, () => `$${globalIdx++}`);
        queries.push(reindexed);
        allParams.push(...resultAPagar.params);
      }
      if (shouldIncludePago) {
        const resultPago = this.getQueryPago(dataInicio, dataFim, false, status, { valorMin: args.valorMin, valorMax: args.valorMax, nomes: args.favorecidoNome });
        const reindexed = resultPago.query.replace(/\$\d+/g, () => `$${globalIdx++}`);
        queries.push(reindexed);
        allParams.push(...resultPago.params);
      }
    }

    if (queries.length === 0) return [];

    let finalQuery = queries.join(' UNION ALL ');

    finalQuery = `SELECT r.nome, ROUND(SUM(r.valor)::numeric, 2) AS valor FROM (${finalQuery}) r GROUP BY r.nome`;
    const havingClauses: string[] = [];
    if (args.valorMin !== undefined) {
      havingClauses.push(`ROUND(SUM(r.valor)::numeric, 2) >= $${globalIdx++}`);
      allParams.push(args.valorMin);
    }
    if (args.valorMax !== undefined) {
      havingClauses.push(`ROUND(SUM(r.valor)::numeric, 2) <= $${globalIdx++}`);
      allParams.push(args.valorMax);
    }
    if (havingClauses.length > 0) {
      finalQuery += ` HAVING ${havingClauses.join(' AND ')}`;
    }
    finalQuery += ` ORDER BY r.nome ASC`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      this.logger.debug(finalQuery);
      const result = await queryRunner.query(finalQuery, allParams);
      return result.map((r) => new RelatorioConsolidadoDto(r));
    } finally {
      await queryRunner.release();
    }
  }
}