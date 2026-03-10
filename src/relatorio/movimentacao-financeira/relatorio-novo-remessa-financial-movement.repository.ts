import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { DataSource } from 'typeorm';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { RelatorioFinancialMovementNovoRemessaData, RelatorioFinancialMovementNovoRemessaDto } from '../dtos/relatorio-financial-and-movement.dto';
import { format } from 'date-fns';

@Injectable()
export class RelatorioNovoRemessaFinancialMovementRepository {
  private readonly logger = new CustomLogger(RelatorioNovoRemessaFinancialMovementRepository.name, { timestamp: true });

  private readonly CONSORCIO_CASE = `(
  CASE
      WHEN pu."permitCode" = '8' THEN 'VLT'
      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
      ELSE op."nomeConsorcio"
    END
  )`

  private readonly STATUS_CASE = `(
    CASE
      WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
      WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
      WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
      WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
      WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
      ELSE 'Rejeitado'
    END
  )`;

  private readonly notCpf = `AND pu."cpfCnpj" NOT IN ('18201378000119','12464869000176','12464539000180','12464553000184','44520687000161','12464577000133')`;

  private readonly baseQuery = `
SELECT DISTINCT 
    da."dataVencimento" AS "dataReferencia",
    opa.id,
    pu."fullName" AS nomes,
    pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
    pu."cpfCnpj",
    ${this.CONSORCIO_CASE} AS "nomeConsorcio",
    da."valorLancamento" AS valor,
    CASE
      WHEN oph."statusRemessa" = 5
           AND opa."ordemPagamentoAgrupadoId" IS NOT NULL
        THEN op_pai."dataPagamento"
      ELSE opa."dataPagamento"
    END AS "dataPagamento",
    ${this.STATUS_CASE} AS status
FROM ordem_pagamento op
INNER JOIN ordem_pagamento_agrupado opa
  ON op."ordemPagamentoAgrupadoId" = opa.id
LEFT JOIN ordem_pagamento_agrupado op_pai
  ON op_pai.id = opa."ordemPagamentoAgrupadoId"
INNER JOIN ordem_pagamento_agrupado_historico oph
  ON oph."ordemPagamentoAgrupadoId" = opa.id
INNER JOIN detalhe_a da
  ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
INNER JOIN public."user" pu
  ON pu."id" = op."userId"
JOIN bank bc
  ON bc.code = pu."bankCode"
WHERE
  da."dataVencimento" BETWEEN $1 AND $2
  AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
  AND (
    ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric) 
    AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
  )
  AND (
    $4::text[] IS NULL OR ${this.STATUS_CASE} = ANY($4)
  )
  AND (
    $5::text[] IS NULL OR ${this.CONSORCIO_CASE} = ANY($5)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM ordem_pagamento_agrupado filha
    WHERE filha."ordemPagamentoAgrupadoId" = opa.id
  )
  AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
`;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

  public async findFinancialMovement(filter: IFindPublicacaoRelatorioNovoFinancialMovement): Promise<RelatorioFinancialMovementNovoRemessaDto> {
    const safeFilter: IFindPublicacaoRelatorioNovoFinancialMovement = {
      ...filter,
      dataInicio: filter.dataInicio ? new Date(filter.dataInicio) : filter.dataInicio,
      dataFim: filter.dataFim ? new Date(filter.dataFim) : filter.dataFim,
      page: filter.page ? Number(filter.page) : undefined,
      pageSize: filter.pageSize ? Number(filter.pageSize) : undefined,
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      let finalQuery: string = this.baseQuery;

      if (safeFilter.todosVanzeiros) finalQuery += ` ${this.notCpf}`;
      if (safeFilter.desativados) finalQuery += ` AND pu.bloqueado = true`;
      finalQuery += ` ORDER BY da."dataVencimento"`;

      const params = this.getQueryParameters(safeFilter);
      const allResults = await queryRunner.query(finalQuery, params);

      const aggregates = this.calculateAggregates(allResults);
      const grouped = this.groupAndSum(allResults);
      const dataOrdenada = Array.from(grouped.values())
        .sort((a, b) => {
          const dateA = this.parseDateBR(a.dataReferencia).getTime();
          const dateB = this.parseDateBR(b.dataReferencia).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return a.nomes.localeCompare(b.nomes, 'pt-BR');
        })
        .map(r => new RelatorioFinancialMovementNovoRemessaData(r));

      const hasPagination = Number.isInteger(safeFilter.page) || Number.isInteger(safeFilter.pageSize);
      const currentPageRaw = Number(safeFilter.page);
      const pageSizeRaw = Number(safeFilter.pageSize);
      const currentPage = Number.isInteger(currentPageRaw) && currentPageRaw > 0 ? currentPageRaw : 1;
      const pageSize = Number.isInteger(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 50;
      const totalCount = dataOrdenada.length;
      const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

      const pagedData = hasPagination
        ? dataOrdenada.slice((currentPage - 1) * pageSize, currentPage * pageSize)
        : dataOrdenada;

      const relatorioDto = new RelatorioFinancialMovementNovoRemessaDto({
        count: totalCount,
        valor: Number.parseFloat(aggregates.valorTotal.toString()),
        valorPago: aggregates.valorPago,
        valorEstornado: aggregates.valorEstornado,
        valorRejeitado: aggregates.valorRejeitado,
        valorAguardandoPagamento: aggregates.valorAguardandoPagamento,
        valorPendente: aggregates.valorPendente,
        valorPendenciaPaga: aggregates.valorPendenciaPaga,
        currentPage,
        pageSize,
        totalPages,
        data: pagedData,
      });

      return relatorioDto;
    } catch (error) {
      this.logger.error('Erro ao executar a query', error);
      throw error;
    } finally {
      await queryRunner.release();
      this.logger.log('QueryRunner liberado.');
    }
  }

  /**
   * Compute aggregates in one pass
   */
  private calculateAggregates(rows: any[]) {
    let valorTotal = 0;
    let valorPago = 0;
    let valorRejeitado = 0;
    let valorEstornado = 0;
    let valorAguardandoPagamento = 0;
    let valorPendente = 0;
    let valorPendenciaPaga = 0;

    for (const cur of rows) {
      const valor = Number.parseFloat(cur.valor || 0);
      valorTotal += valor;

      switch ((cur.status || '').toString()) {
        case 'Pago':
          valorPago += valor;
          break;
        case 'Rejeitado':
          valorRejeitado += valor;
          break;
        case 'Estorno':
          valorEstornado += valor;
          break;
        case 'Aguardando Pagamento':
          valorAguardandoPagamento += valor;
          break;
        case 'Pendente':
          valorPendente += valor;
          break;
        case 'Pendencia Paga':
          valorPendenciaPaga += valor;
          break;
      }
    }

    return {
      valorTotal,
      valorPago,
      valorRejeitado,
      valorEstornado,
      valorAguardandoPagamento,
      valorPendente,
      valorPendenciaPaga,
    };
  }


  private groupAndSum(rows: any[]) {
    const map = new Map<string, any>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      const dataReferencia = this.formatDateToBR(r.dataReferencia) || '01/01/1970';
      const dataPagamento = this.formatDateToBR(r.dataPagamento);
      const valor = +r.valor || 0;

      const key = dataReferencia + r.cpfCnpj + r.status + dataPagamento;

      const existing = map.get(key);

      if (existing) {
        existing.valor += valor;
      } else {
        map.set(key, {
          dataReferencia,
          nomes: r.nomes,
          email: r.email,
          codBanco: r.codBanco,
          nomeBanco: r.nomeBanco,
          cpfCnpj: r.cpfCnpj,
          consorcio: r.nomeConsorcio || r.consorcio,
          valor,
          status: r.status,
          dataPagamento,
        });
      }
    }

    return map;
  }

  private parseDateBR(dateStr: string | null | undefined) {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    const [d, m, y] = parts.map(v => Number(v));
    const parsed = new Date(y, (m || 1) - 1, d || 1);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  private formatDateToBR(value: any): string | null {
    try {
      if (!value) return null;

      let date: Date;
      if (value instanceof Date) {
        date = value;
      } else if (typeof value === 'string') {
        if (value.includes('/')) {
          const parts = value.split('/').map(p => parseInt(p, 10));
          if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            date = new Date(parts[2], parts[1] - 1, parts[0]);
          } else {
            return null;
          }
        } else {
          date = new Date(value);
        }
      } else if (typeof value === 'number') {
        date = new Date(value);
      } else {
        return null;
      }

      if (Number.isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat('pt-BR').format(date);
    } catch (e) {
      return null;
    }
  }


  private getStatusParaFiltro(filter: {
    pago?: boolean;
    erro?: boolean;
    estorno?: boolean;
    rejeitado?: boolean;
    emProcessamento?: boolean;
    pendenciaPaga?: boolean;
    pendentes?: boolean;
    aPagar?: boolean;
  }): string[] | null {
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

    for (const m of mapping) if (m.cond) statuses.push(...m.vals);

    return statuses.length ? statuses : null;
  }


  private getQueryParameters(filter: IFindPublicacaoRelatorioNovoFinancialMovement): any[] {
    let consorcioNome: string[] | null = filter.consorcioNome
      ? filter.consorcioNome.map(n => n.toUpperCase().trim())
      : null;

    const dataInicio = format(new Date(filter.dataInicio), 'yyyy-MM-dd') || null;
    const dataFim = format(new Date(filter.dataFim), 'yyyy-MM-dd') || null;
    const userIds = filter.userIds || null;
    const valorMin = filter.valorMin || null;
    const valorMax = filter.valorMax || null;

    return [
      dataInicio,
      dataFim,
      userIds,
      this.getStatusParaFiltro(filter) || null,
      consorcioNome,
      valorMin,
      valorMax
    ];
  }

}
