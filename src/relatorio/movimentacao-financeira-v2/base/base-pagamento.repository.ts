import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { buildStatusPagamentoCaseSql } from '../status/status-resolver';

export type Perfil = 'permissionario' | 'guardador';

export interface BasePagamentoFilter {
  dataInicio: Date;
  dataFim: Date;
  statuses?: StatusPagamento[];
  valorMin?: number;
  valorMax?: number;
}

export interface BasePagamentoRow {
  dataReferencia: Date;
  nomes: string;
  cpfCnpj: string;
  valor: string;
  status: StatusPagamento;
}

const ORDEM_TABLE: Record<Perfil, string> = {
  permissionario: 'ordem_pagamento',
  guardador: 'ordem_pagamento_guardador',
};

// ordem_pagamento_guardador has no dataCaptura column (only dataOrdem) - it stands in as the
// "never-grouped" cutoff date for that profile.
const DATA_CAPTURA_COLUMN: Record<Perfil, string> = {
  permissionario: 'dataCaptura',
  guardador: 'dataOrdem',
};

const VALOR_COLUMN: Record<Perfil, string> = {
  permissionario: 'valor',
  guardador: 'valorRepasseGuardador',
};

@Injectable()
export class BasePagamentoRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findGroupedRows(perfil: Perfil, filter: BasePagamentoFilter): Promise<BasePagamentoRow[]> {
    const ordemTable = ORDEM_TABLE[perfil];
    const dataCapturaColumn = DATA_CAPTURA_COLUMN[perfil];
    const valorColumn = VALOR_COLUMN[perfil];
    const statusCase = buildStatusPagamentoCaseSql('oph');

    const sql = `
      WITH agrupada AS (
        -- Ordens ja agrupadas com detalhe_a (Pago / A Pagar enviado / Aguardando Pagamento /
        -- Estorno / Rejeitado / Pendencia Paga, via resolver de status compartilhado).
        -- Dedupe de fan-out (ADR 0011): uma linha representativa por agrupamento (LATERAL),
        -- nunca uma por ordem filha.
        SELECT
          da."dataVencimento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          da."valorLancamento" AS valor,
          ${statusCase} AS status
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        INNER JOIN LATERAL (
          SELECT rep."userId" FROM ${ordemTable} rep WHERE rep."ordemPagamentoAgrupadoId" = opa.id LIMIT 1
        ) representante ON true
        LEFT JOIN public."user" pu ON pu.id = representante."userId"
        WHERE da."dataVencimento"::date BETWEEN $1::date AND $2::date
      ),
      agrupada_somada AS (
        -- Soma lotes distintos (agrupamentos diferentes) do mesmo favorecido/dia/status - unico
        -- nivel de agregacao desta fonte. Nao se mistura com a fonte "nunca enviada" abaixo: cada
        -- fonte agrega (ou nao) dentro de si mesma, nunca as duas juntas.
        SELECT "dataReferencia", nomes, "cpfCnpj", SUM(valor) AS valor, status
        FROM agrupada
        GROUP BY "dataReferencia", nomes, "cpfCnpj", status
      ),
      nunca_enviada AS (
        -- Ordens nunca agrupadas/enviadas (ADR 0017): sem valorLancamento de lote a somar, cada
        -- ordem permanece sua propria linha - nao ha agregacao nesta fonte.
        SELECT
          op."${dataCapturaColumn}"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          op."${valorColumn}" AS valor,
          '${StatusPagamento.A_PAGAR}' AS status
        FROM ${ordemTable} op
        LEFT JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
        LEFT JOIN public."user" pu ON pu.id = op."userId"
        LEFT JOIN ordem_pagamento_agrupado_historico oph ON opa.id = oph."ordemPagamentoAgrupadoId"
        LEFT JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        WHERE (op."ordemPagamentoAgrupadoId" IS NULL OR da.id IS NULL)
          AND op."${dataCapturaColumn}"::date BETWEEN $1::date AND $2::date
      ),
      combinado AS (
        SELECT * FROM agrupada_somada
        UNION ALL
        SELECT * FROM nunca_enviada
      )
      SELECT "dataReferencia", nomes, "cpfCnpj", valor, status
      FROM combinado
      WHERE ($3::text[] IS NULL OR status = ANY($3))
        AND ($4::numeric IS NULL OR valor >= $4)
        AND ($5::numeric IS NULL OR valor <= $5)
      ORDER BY "dataReferencia", nomes
    `;

    return this.dataSource.query(sql, [
      filter.dataInicio,
      filter.dataFim,
      filter.statuses?.length ? filter.statuses : null,
      filter.valorMin ?? null,
      filter.valorMax ?? null,
    ]);
  }
}
