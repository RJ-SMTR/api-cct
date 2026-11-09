import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { buildConsorcioCaseSql } from '../status/consorcio-resolver';
import { buildStatusPagamentoCaseSql } from '../status/status-resolver';
import { pivotStucGratuidadeRows, StucPivotOutputRow } from '../../utils/stuc-gratuidade-pivot';

// STUC - Gratuidade (ADR 0004/0012, Permissionario apenas) tem uma fonte de dados, uma
// identidade de linha e uma forma de saida (pivot de janela de pagamento, ate 4 colunas
// dia-a-dia) completamente diferentes de BasePagamentoRepository.findGroupedRows:
// - FK de agrupamento propria (ordemPagamentoAgrupadoGratuidadeId, nao ordemPagamentoAgrupadoId).
// - Sem dedupe de fan-out/representante por LATERAL (ADR 0007/0011): valorGratuidade e
//   genuinamente por ordem, cada ordem fica sua propria linha antes do pivot.
// - dataReferencia por ordem (DATE(op."dataOrdem")), nao por lote - necessario para o pivot
//   (ADR 0012/2026-10-26, pivotStucGratuidadeRows) cair na coluna certa.
// Por isso e' um repository dedicado, nao um metodo/fonte adicional em base-pagamento.repository.ts
// (arquivo compartilhado por T4/T6/T7 em paralelo) - menos risco de conflito de merge, e o
// shape de saida (StucGratuidadeRow, com 4 pares data/valor) nao se encaixaria na CTE
// "combinado" existente sem reescreve-la.
export interface StucGratuidadeFilter {
  dataInicio: Date;
  dataFim: Date;
  statuses?: StatusPagamento[];
  valorMin?: number;
  valorMax?: number;
  userIds?: number[];
}

type StucGratuidadeIdentity = {
  nomes: string;
  cpfCnpj: string;
  nomeConsorcio: string | null;
  status: StatusPagamento;
};

type StucGratuidadeDayRow = StucGratuidadeIdentity & { dataReferencia: Date; valor: string };

export type StucGratuidadeRow = StucPivotOutputRow<StucGratuidadeIdentity>;

const CONSORCIO_CASE = buildConsorcioCaseSql('pu', 'op');

@Injectable()
export class StucGratuidadeRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findRows(filter: StucGratuidadeFilter): Promise<StucGratuidadeRow[]> {
    const dayRows = await this.findDayRows(filter);
    const groupKeyFn = (row: StucGratuidadeIdentity & { dataReferencia: Date; valor: number }) =>
      `${row.nomes}::${row.cpfCnpj}::${row.nomeConsorcio}::${row.status}`;
    const pivoted = pivotStucGratuidadeRows(
      dayRows.map((row) => ({ ...row, valor: Number(row.valor) })),
      groupKeyFn,
    );
    // valorMin/valorMax se referem ao Valor Lancamento (a janela de pagamento ja pivotada, ate
    // 4 dias somados), nao ao valor de um dia isolado - aplicado depois do pivot, mesma
    // abordagem do legado (findStucGratuidadePivotedRows em
    // relatorio-novo-remessa-financial-movement.service.ts).
    return pivoted.filter(
      (row) => (filter.valorMin === undefined || row.valor >= filter.valorMin) && (filter.valorMax === undefined || row.valor <= filter.valorMax),
    );
  }

  private async findDayRows(filter: StucGratuidadeFilter): Promise<StucGratuidadeDayRow[]> {
    const statusCase = buildStatusPagamentoCaseSql('oph');
    // Estorno/Rejeitado (pendencia_pagamento) so e' consultado em dia unico - restricao ja
    // existente no legado (buildStucGratuidadePendenciaPagamentoSingleDateQuery so e' chamada
    // quando isSingleDate, comentario em relatorio-novo-remessa-financial-movement.service.ts
    // linha ~458: "fora do escopo do ADR 0020" - preservada aqui de proposito, nao e' um gap
    // novo desta reescrita).
    const isSingleDate = dateOnly(filter.dataInicio) === dateOnly(filter.dataFim);

    const sql = `
      WITH agrupada AS (
        -- Pago / A Pagar enviado / Aguardando Pagamento. Sem LATERAL/representante (ver
        -- comentario no topo do arquivo): cada ordem e' sua propria linha, valorGratuidade e'
        -- por ordem (ADR 0007), nao ha fan-out a deduplicar como em AGRUPAMENTO_NORMAL (T2).
        SELECT
          DATE(op."dataOrdem") AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${CONSORCIO_CASE} AS "nomeConsorcio",
          op."valorGratuidade" AS valor,
          ${statusCase} AS status
        FROM ordem_pagamento op
        INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoGratuidadeId" = opa.id
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        LEFT JOIN public."user" pu ON pu.id = op."userId"
        WHERE op."valorGratuidade" IS NOT NULL AND op."valorGratuidade" <> 0
          AND da."dataVencimento"::date BETWEEN $1::date AND $2::date
          AND oph."statusRemessa" NOT IN (4, 5)
          AND ($4::integer[] IS NULL OR pu.id = ANY($4))
      ),
      pendencia_paga AS (
        -- Pendencia Paga (status 5, ADR 0001): sem gate de dia unico, data vem do pai quando ha
        -- familia (mesma regra do fluxo normal, T5), por ordem (nao por lote).
        SELECT
          DATE(op."dataOrdem") AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${CONSORCIO_CASE} AS "nomeConsorcio",
          op."valorGratuidade" AS valor,
          '${StatusPagamento.PENDENCIA_PAGA}' AS status
        FROM ordem_pagamento op
        INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoGratuidadeId" = opa.id
        LEFT JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        LEFT JOIN public."user" pu ON pu.id = op."userId"
        WHERE op."valorGratuidade" IS NOT NULL AND op."valorGratuidade" <> 0
          AND oph."statusRemessa" = 5
          AND (
            (opa."ordemPagamentoAgrupadoId" IS NOT NULL AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date)
            OR (opa."ordemPagamentoAgrupadoId" IS NULL AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date)
          )
          AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
          AND ($4::integer[] IS NULL OR pu.id = ANY($4))
      ),
      pendencia_pagamento AS (
        ${isSingleDate ? this.buildPendenciaPagamentoDiaUnicoSql(statusCase) : 'SELECT NULL::date AS "dataReferencia", NULL::text AS nomes, NULL::text AS "cpfCnpj", NULL::text AS "nomeConsorcio", NULL::numeric AS valor, NULL::text AS status WHERE FALSE'}
      ),
      combinado AS (
        SELECT * FROM agrupada
        UNION ALL
        SELECT * FROM pendencia_paga
        UNION ALL
        SELECT * FROM pendencia_pagamento
      )
      SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", valor, status
      FROM combinado
      WHERE ($3::text[] IS NULL OR status = ANY($3))
      ORDER BY "dataReferencia"
    `;

    return this.dataSource.query(sql, [
      filter.dataInicio,
      filter.dataFim,
      filter.statuses?.length ? filter.statuses : null,
      filter.userIds?.length ? filter.userIds : null,
    ]);
  }

  // Dia unico (ADR 0008, aplicado a gratuidade sem o filtro de elegibilidade do ADR 0020 - o
  // legado nunca aplicou ADR 0020 a STUC, so ao fluxo normal via buildPendenciaPagamentoTemplate
  // no caminho de intervalo, que STUC nunca usa). dataReferencia = da."dataVencimento" (nao
  // op."dataOrdem"): aqui cada linha ja' representa uma tentativa/detalhe_a propria, nao um
  // lote com varias ordens-filhas em dias diferentes (ADR 0012/achado 2026-10-26, que motivou
  // DATE(op."dataOrdem") nas duas fontes acima, nao se aplica a esta).
  private buildPendenciaPagamentoDiaUnicoSql(statusPropria: string): string {
    const statusPai = buildStatusPagamentoCaseSql('oph_pai');
    const statusRejeitado = `'${StatusPagamento.ERRO_ESTORNO}', '${StatusPagamento.ERRO_REJEITADO}'`;
    return `
        SELECT
          da."dataVencimento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${CONSORCIO_CASE} AS "nomeConsorcio",
          op."valorGratuidade" AS valor,
          ${statusPai} AS status
        FROM ordem_pagamento op
        INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoGratuidadeId" = opa.id
        INNER JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        INNER JOIN ordem_pagamento_agrupado_historico oph_pai ON oph_pai.id = (
          SELECT MAX(oph_mais_recente.id) FROM ordem_pagamento_agrupado_historico oph_mais_recente WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = op_pai.id
        )
        LEFT JOIN public."user" pu ON pu.id = op."userId"
        WHERE op."valorGratuidade" IS NOT NULL AND op."valorGratuidade" <> 0
          AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
          AND ${statusPai} IN (${statusRejeitado})
          AND (oph_pai."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph_pai."motivoStatusRemessa" IS NULL)
          AND ($4::integer[] IS NULL OR pu.id = ANY($4))

        UNION ALL

        -- Sem pai (ADR 0008): nunca foi filha - usa a propria data/status do registro.
        SELECT
          da."dataVencimento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${CONSORCIO_CASE} AS "nomeConsorcio",
          op."valorGratuidade" AS valor,
          ${statusPropria} AS status
        FROM ordem_pagamento op
        INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoGratuidadeId" = opa.id
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        LEFT JOIN public."user" pu ON pu.id = op."userId"
        WHERE op."valorGratuidade" IS NOT NULL AND op."valorGratuidade" <> 0
          AND opa."ordemPagamentoAgrupadoId" IS NULL
          AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date
          AND ${statusPropria} IN (${statusRejeitado})
          AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
          AND ($4::integer[] IS NULL OR pu.id = ANY($4))
    `;
  }
}

function dateOnly(value: Date): string {
  return new Date(value).toISOString().slice(0, 10);
}
