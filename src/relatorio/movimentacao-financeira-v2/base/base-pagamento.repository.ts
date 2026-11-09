import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { pendenciaRejeitadaGuardador, pendenciaRejeitadaPermissionario } from '../../novo-remessa/queries/regras-pendencia';
import { buildConsorcioCaseSql, CONSORCIOS, INSTITUTIONAL_CPF_CNPJ, MODAIS } from '../status/consorcio-resolver';
import { buildStatusPagamentoCaseSql } from '../status/status-resolver';

export type Perfil = 'permissionario' | 'guardador';

export interface BasePagamentoFilter {
  dataInicio: Date;
  dataFim: Date;
  statuses?: StatusPagamento[];
  valorMin?: number;
  valorMax?: number;
  // Favorecido/Consorcio/Modal (T3, Permissionario apenas - Guardador nesta camada so suporta
  // userIds, sem a distincao modal/consorcio que nao existe nesse perfil). "Nenhum selecionado"
  // (nem userIds nem consorcio) normaliza para o mesmo comportamento de todosVanzeiros=true
  // (ADR 0014), aplicado dentro do repository - nao precisa ser setado explicitamente pelo
  // chamador.
  userIds?: number[];
  consorcioNome?: string[];
  todosConsorcios?: boolean;
}

export interface BasePagamentoRow {
  dataReferencia: Date;
  nomes: string;
  cpfCnpj: string;
  nomeConsorcio: string | null;
  valor: string;
  status: StatusPagamento;
}

// Guardador nao tem o conceito de consorcio nesta forma (fora de escopo da fatia 1, ADR 0022) -
// nomeConsorcio sai sempre null para esse perfil, nunca inventado. Dois pontos de resolucao
// porque os aliases disponiveis diferem por fonte: "nunca_enviada" tem a tabela de ordem em si
// (op), "agrupada" so tem o representante trazido pela LATERAL (sem coluna nomeConsorcio bruta
// disponivel ali a menos que a subquery da LATERAL a selecione tambem, ver REPRESENTANTE_EXTRA).
const NOME_CONSORCIO_NUNCA_ENVIADA: Record<Perfil, string> = {
  permissionario: buildConsorcioCaseSql('pu', 'op'),
  guardador: 'NULL',
};

const NOME_CONSORCIO_AGRUPADA: Record<Perfil, string> = {
  permissionario: buildConsorcioCaseSql('pu', 'representante'),
  guardador: 'NULL',
};

// ordem_pagamento_guardador nao tem coluna nomeConsorcio - so o Permissionario precisa dela na
// LATERAL (o alias de saida precisa se chamar "nomeConsorcio" para casar com o CASE acima).
const REPRESENTANTE_EXTRA_COLUMN: Record<Perfil, string> = {
  permissionario: ', rep."nomeConsorcio"',
  guardador: '',
};

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

// Pendencia Paga/Pendencia de Pagamento (T5, ADR 0021) sao lidas sempre pela ordem_pagamento_
// agrupado - guardador nao tem tabela propria para essas duas fontes (ordem_pagamento_guardador
// so entra via a LATERAL "representante", igual as fontes acima).
const AGRUPAMENTO_SEM_FILHAS = (alias: string) =>
  `NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado filha WHERE filha."ordemPagamentoAgrupadoId" = ${alias}.id)`;

const representanteLateral = (perfil: Perfil, ordemTable: string) => `
  INNER JOIN LATERAL (
    SELECT rep."userId"${REPRESENTANTE_EXTRA_COLUMN[perfil]} FROM ${ordemTable} rep WHERE rep."ordemPagamentoAgrupadoId" = opa.id LIMIT 1
  ) representante ON true
  LEFT JOIN public."user" pu ON pu.id = representante."userId"
`;

function resolveElegibilidadeRejeitado(perfil: Perfil): string {
  return perfil === 'guardador'
    ? pendenciaRejeitadaGuardador({ oph: 'oph', da: 'da', opa: 'opa', pu: 'pu' })
    : pendenciaRejeitadaPermissionario({ oph: 'oph', da: 'da', opa: 'opa', users: ['pu'] });
}

// Resolve a lista de nomeConsorcio aceitos no filtro final e se os CNPJs institucionais devem
// ser excluidos - so se aplica ao Permissionario (Guardador nao tem esse conceito nesta
// camada, T3). Espelha a Desired Behavior de docs/tasks/T3.md:
// - userIds especifico: sem restricao de consorcio/modal (favorecido ja escolhido a dedo).
// - consorcioNome especifico ou todosConsorcios: lista correspondente, CNPJs institucionais
//   inclusos, sem restricao a modais (ADR 0018).
// - nada selecionado (nem userIds, nem consorcio): só modais, CNPJs institucionais excluidos
//   (ADR 2026-11-04/MODAIS_FILTER) - mesmo efeito de "Favorecido = Todos" default (ADR 0014).
function resolveConsorcioFilter(perfil: Perfil, filter: BasePagamentoFilter): { nomeConsorcioList: string[] | null; excludeInstitutional: boolean } {
  if (perfil === 'guardador') {
    return { nomeConsorcioList: null, excludeInstitutional: false };
  }
  if (filter.consorcioNome?.length) {
    return { nomeConsorcioList: filter.consorcioNome.map((nome) => nome.trim().toUpperCase()), excludeInstitutional: false };
  }
  if (filter.todosConsorcios) {
    return { nomeConsorcioList: [...CONSORCIOS], excludeInstitutional: false };
  }
  if (filter.userIds?.length) {
    return { nomeConsorcioList: null, excludeInstitutional: false };
  }
  return { nomeConsorcioList: [...MODAIS], excludeInstitutional: true };
}

@Injectable()
export class BasePagamentoRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findGroupedRows(perfil: Perfil, filter: BasePagamentoFilter): Promise<BasePagamentoRow[]> {
    const ordemTable = ORDEM_TABLE[perfil];
    const dataCapturaColumn = DATA_CAPTURA_COLUMN[perfil];
    const valorColumn = VALOR_COLUMN[perfil];
    const statusCase = buildStatusPagamentoCaseSql('oph');
    const { nomeConsorcioList, excludeInstitutional } = resolveConsorcioFilter(perfil, filter);
    const lateral = representanteLateral(perfil, ordemTable);
    // ADR 0001/0020: Pendencia Paga (5) e Rejeitado/Estorno (4) nunca vem desta fonte, que
    // filtra por data de VENCIMENTO - as duas tem data/regra propria (pendencia_paga*,
    // pendencia_pagamento abaixo), filtradas por data de PAGAMENTO.
    const isSingleDate = dateOnly(filter.dataInicio) === dateOnly(filter.dataFim);

    const sql = `
      WITH agrupada AS (
        -- Ordens ja agrupadas com detalhe_a (Pago / A Pagar enviado / Aguardando Pagamento, via
        -- resolver de status compartilhado). Dedupe de fan-out (ADR 0011): uma linha
        -- representativa por agrupamento (LATERAL), nunca uma por ordem filha.
        SELECT
          da."dataVencimento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          ${statusCase} AS status
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        ${lateral}
        WHERE da."dataVencimento"::date BETWEEN $1::date AND $2::date
          AND oph."statusRemessa" NOT IN (4, 5)
          AND ($6::integer[] IS NULL OR pu.id = ANY($6))
      ),
      pendencia_paga AS (
        -- Pendencia Paga (status 5, ADR 0001): sem gate de dia unico - sempre pela data de
        -- pagamento do pai quando existe (familia), senao a propria. Uma linha por filha (nao
        -- soma lotes diferentes entre si, ao contrario de agrupada_somada).
        SELECT
          (CASE WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN op_pai."dataPagamento" ELSE opa."dataPagamento" END)::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          '${StatusPagamento.PENDENCIA_PAGA}' AS status
        FROM ordem_pagamento_agrupado opa
        LEFT JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        ${lateral}
        WHERE oph."statusRemessa" = 5
          AND ${AGRUPAMENTO_SEM_FILHAS('opa')}
          AND (
            (opa."ordemPagamentoAgrupadoId" IS NOT NULL AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date)
            OR (opa."ordemPagamentoAgrupadoId" IS NULL AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date)
          )
          AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
          AND da.id = (
            -- Uma filha paga guarda detalhe_a de todas as tentativas antigas - mantem uma so
            -- linha: a de mesmo valor do valorTotal da filha, senao a mais recente.
            SELECT da_filha.id
            FROM ordem_pagamento_agrupado_historico oph_filha
            INNER JOIN detalhe_a da_filha ON da_filha."ordemPagamentoAgrupadoHistoricoId" = oph_filha.id
            WHERE oph_filha."ordemPagamentoAgrupadoId" = opa.id AND oph_filha."statusRemessa" = 5
            ORDER BY (ROUND(da_filha."valorLancamento"::numeric, 2) = ROUND(opa."valorTotal"::numeric, 2)) DESC, da_filha.id DESC
            LIMIT 1
          )
          AND ($6::integer[] IS NULL OR pu.id = ANY($6))
      ),
      pendencia_paga_passo0 AS (
        -- PASSO 0: filha paga nunca enviada em arquivo proprio (nenhum historico dela tem
        -- detalhe_a) - valor = valorTotal da propria opa filha, data = pagamento do pai.
        SELECT
          op_pai."dataPagamento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          ROUND(opa."valorTotal"::numeric, 2) AS valor,
          '${StatusPagamento.PENDENCIA_PAGA}' AS status
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph.id = (
          SELECT MAX(oph_mais_recente.id) FROM ordem_pagamento_agrupado_historico oph_mais_recente WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = opa.id
        )
        ${lateral}
        WHERE ${AGRUPAMENTO_SEM_FILHAS('opa')}
          AND oph."statusRemessa" = 5
          AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
          AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
          AND NOT EXISTS (
            SELECT 1
            FROM ordem_pagamento_agrupado_historico oph_qualquer
            INNER JOIN detalhe_a da_qualquer ON da_qualquer."ordemPagamentoAgrupadoHistoricoId" = oph_qualquer.id
            WHERE oph_qualquer."ordemPagamentoAgrupadoId" = opa.id
          )
          AND ($6::integer[] IS NULL OR pu.id = ANY($6))
      ),
      pendencia_pagamento AS (
        ${isSingleDate ? this.buildPendenciaPagamentoDiaUnicoSql(perfil, lateral) : this.buildPendenciaPagamentoIntervaloSql(perfil, lateral)}
      ),
      agrupada_somada AS (
        -- Soma lotes distintos (agrupamentos diferentes) do mesmo favorecido/dia/status - unico
        -- nivel de agregacao desta fonte. Nao se mistura com a fonte "nunca enviada" abaixo: cada
        -- fonte agrega (ou nao) dentro de si mesma, nunca as duas juntas. nomeConsorcio entra no
        -- GROUP BY mas e deterministico por favorecido/ordem (nao fragmenta totais reais).
        SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", SUM(valor) AS valor, status
        FROM agrupada
        GROUP BY "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", status
      ),
      nunca_enviada AS (
        -- Ordens nunca agrupadas/enviadas (ADR 0017): sem valorLancamento de lote a somar, cada
        -- ordem permanece sua propria linha - nao ha agregacao nesta fonte.
        SELECT
          op."${dataCapturaColumn}"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_NUNCA_ENVIADA[perfil]} AS "nomeConsorcio",
          op."${valorColumn}" AS valor,
          '${StatusPagamento.A_PAGAR}' AS status
        FROM ${ordemTable} op
        LEFT JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
        LEFT JOIN public."user" pu ON pu.id = op."userId"
        LEFT JOIN ordem_pagamento_agrupado_historico oph ON opa.id = oph."ordemPagamentoAgrupadoId"
        LEFT JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        WHERE (op."ordemPagamentoAgrupadoId" IS NULL OR da.id IS NULL)
          AND op."${dataCapturaColumn}"::date BETWEEN $1::date AND $2::date
          AND ($6::integer[] IS NULL OR pu.id = ANY($6))
      ),
      combinado AS (
        SELECT * FROM agrupada_somada
        UNION ALL
        SELECT * FROM nunca_enviada
        UNION ALL
        SELECT * FROM pendencia_paga
        UNION ALL
        SELECT * FROM pendencia_paga_passo0
        UNION ALL
        SELECT * FROM pendencia_pagamento
      )
      SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", valor, status
      FROM combinado
      WHERE ($3::text[] IS NULL OR status = ANY($3))
        AND ($4::numeric IS NULL OR valor >= $4)
        AND ($5::numeric IS NULL OR valor <= $5)
        AND ($7::text[] IS NULL OR "nomeConsorcio" = ANY($7))
        AND ($8::text[] IS NULL OR NOT ("cpfCnpj" = ANY($8)))
      ORDER BY "dataReferencia", nomes
    `;

    return this.dataSource.query(sql, [
      filter.dataInicio,
      filter.dataFim,
      filter.statuses?.length ? filter.statuses : null,
      filter.valorMin ?? null,
      filter.valorMax ?? null,
      filter.userIds?.length ? filter.userIds : null,
      nomeConsorcioList,
      excludeInstitutional ? [...INSTITUTIONAL_CPF_CNPJ] : null,
    ]);
  }

  // Dia unico (ADR 0008/nota do ADR 0001): a familia pai define status (historico mais recente
  // do pai) e data de referencia; o valor e' da propria filha. Sem filtro de elegibilidade (ADR
  // 0020) - esta consulta dedicada nunca teve esse filtro no legado, so o caminho de intervalo.
  private buildPendenciaPagamentoDiaUnicoSql(perfil: Perfil, lateral: string): string {
    const statusPai = buildStatusPagamentoCaseSql('oph_pai');
    const statusPropria = buildStatusPagamentoCaseSql('oph');
    const statusRejeitado = `'${StatusPagamento.ERRO_ESTORNO}', '${StatusPagamento.ERRO_REJEITADO}'`;
    return `
        SELECT
          op_pai."dataPagamento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          ${statusPai} AS status
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        INNER JOIN ordem_pagamento_agrupado_historico oph_pai ON oph_pai.id = (
          SELECT MAX(oph_mais_recente.id) FROM ordem_pagamento_agrupado_historico oph_mais_recente WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = op_pai.id
        )
        ${lateral}
        WHERE op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
          AND ${statusPai} IN (${statusRejeitado})
          AND (oph_pai."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph_pai."motivoStatusRemessa" IS NULL)
          AND ($6::integer[] IS NULL OR pu.id = ANY($6))

        UNION ALL

        -- Sem pai (ADR 0008): nunca foi filha - usa a propria data/status do registro.
        SELECT
          opa."dataPagamento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          ${statusPropria} AS status
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        ${lateral}
        WHERE opa."ordemPagamentoAgrupadoId" IS NULL
          AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date
          AND ${statusPropria} IN (${statusRejeitado})
          AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
          AND ($6::integer[] IS NULL OR pu.id = ANY($6))
    `;
  }

  // Intervalo maior que um dia: orientado pela propria filha (data de vencimento), com o
  // filtro de elegibilidade do ADR 0020 - so mostra o que ainda seria pago de novo, mesma regra
  // da procedure real (reusada de regras-pendencia.ts, nunca reescrita).
  private buildPendenciaPagamentoIntervaloSql(perfil: Perfil, lateral: string): string {
    const statusPropria = buildStatusPagamentoCaseSql('oph');
    return `
        SELECT
          da."dataVencimento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          ${statusPropria} AS status
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        ${lateral}
        WHERE da."dataVencimento"::date BETWEEN $1::date AND $2::date
          AND ${AGRUPAMENTO_SEM_FILHAS('opa')}
          AND ${resolveElegibilidadeRejeitado(perfil)}
          AND ($6::integer[] IS NULL OR pu.id = ANY($6))
    `;
  }
}

function dateOnly(value: Date): string {
  return new Date(value).toISOString().slice(0, 10);
}
