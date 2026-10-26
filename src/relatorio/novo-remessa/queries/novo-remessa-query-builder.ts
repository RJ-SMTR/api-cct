import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { buildCodigoErroSql } from './descricao-erro';

export type NovoRemessaBaseParams = {
  todosVanzeiros?: boolean;
  consorcioFilterParamIndex: number;
  parentErrorStatuses?: Array<'Estorno' | 'Rejeitado'>;
};

export type NovoRemessaPendentesParams = {
  todosVanzeiros?: boolean;
};

export const CONSORCIO_CASE = `
  CASE
    WHEN pu."permitCode" = '8' THEN 'VLT'
    WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
    WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
    WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
    ELSE op."nomeConsorcio"
  END
`;

export const STATUS_CASE = `
  CASE
    WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;

const buildStatusCase = (historyAlias: string) => `
  CASE
    WHEN ${historyAlias}."statusRemessa" = 5 THEN 'Pendencia Paga'
    WHEN ${historyAlias}."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN ${historyAlias}."statusRemessa" IN (0,1) THEN 'A Pagar'
    WHEN ${historyAlias}."motivoStatusRemessa" IN ('00', 'BD') OR ${historyAlias}."statusRemessa" = 3 THEN 'Pago'
    WHEN ${historyAlias}."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;

export const ELEICAO_STATUS_CASE = `
  CASE
    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;

export const ELEICAO_STATUS_FILTER = `
  (
    $4::text[] IS NULL
    OR ${ELEICAO_STATUS_CASE} = ANY($4)
    OR NOT (
      'Aguardando Pagamento' = ANY($4)
      OR 'Pago' = ANY($4)
      OR 'Estorno' = ANY($4)
      OR 'Rejeitado' = ANY($4)
    )
  )
`;

export const NOT_CPF_FILTER = `
  AND pu."cpfCnpj" NOT IN (
    '18201378000119',
    '12464869000176',
    '12464539000180',
    '12464553000184',
    '44520687000161',
    '12464577000133'
  )
`;

/**
 * buildBaseQuery/buildStucGratuidadeQuery (e as duas famílias de dia único abaixo) só
 * diferem na origem do agrupamento (normal vs gratuidade) e na coluna de valor - os
 * templates abaixo capturam essa diferença uma vez, para as duas famílias não divergirem
 * silenciosamente entre si (ex.: um fix no filtro de valor aplicado só numa das duas).
 */
type AgrupamentoSource = {
  /** Coluna de ordem_pagamento usada para chegar no agrupamento (normal ou de gratuidade). */
  agrupamentoJoinColumn: 'ordemPagamentoAgrupadoId' | 'ordemPagamentoAgrupadoGratuidadeId';
  /** Expressão (com alias) da coluna de valor. */
  valorSelect: string;
  /** Filtro extra de WHERE (sem o "AND" final), ou undefined para o fluxo normal. */
  extraWhere?: string;
  /**
   * AGRUPAMENTO_NORMAL soma várias OrdemPagamento num único detalhe_a/valorLancamento (o
   * valor do lote, não de uma ordem - CONTEXT.md, glossário "OrdemPagamentoAgrupado"). Sem
   * restringir a uma ordem representante por agrupamento, uma linha por ordem filha repete o
   * mesmo valorLancamento e o SUM() do service soma o mesmo lançamento uma vez por ordem
   * agrupada (ADR 0011, corrige o ADR 0010). AGRUPAMENTO_GRATUIDADE não liga isso: cada ordem
   * tem seu próprio valorGratuidade, genuinamente por ordem (ADR 0007).
   */
  umaOrdemPorAgrupamento?: boolean;
  /**
   * Override de "dataReferencia" para buildPendenciaPagamentoTemplate (Estorno/Rejeitado).
   * Por padrão esse template usa a data de pagamento da tentativa (op_pai/opa."dataPagamento")
   * - undefined mantém esse comportamento (AGRUPAMENTO_NORMAL). AGRUPAMENTO_GRATUIDADE precisa
   * do dia real de cada ordem (da."dataVencimento") para o pivot de janela de pagamento (ADR
   * 0012/pivotStucGratuidadeRows) conseguir separar os dias da janela - usar a data de pagamento
   * aqui colapsaria os dias distintos de uma mesma janela em uma única linha.
   */
  dataReferenciaPendenciaPagamento?: string;
};

const AGRUPAMENTO_NORMAL: AgrupamentoSource = {
  agrupamentoJoinColumn: 'ordemPagamentoAgrupadoId',
  valorSelect: 'da."valorLancamento" AS valor',
  umaOrdemPorAgrupamento: true,
};

const AGRUPAMENTO_GRATUIDADE: AgrupamentoSource = {
  agrupamentoJoinColumn: 'ordemPagamentoAgrupadoGratuidadeId',
  valorSelect: 'op."valorGratuidade" AS valor',
  extraWhere: 'op."valorGratuidade" IS NOT NULL AND op."valorGratuidade" <> 0',
  dataReferenciaPendenciaPagamento: 'da."dataVencimento"',
};

const umaOrdemPorAgrupamentoFilter = (source: AgrupamentoSource) =>
  source.umaOrdemPorAgrupamento
    ? `AND op.id = (
        SELECT MIN(o.id) FROM ordem_pagamento o WHERE o."${source.agrupamentoJoinColumn}" = opa.id
      )`
    : '';

// Sem DISTINCT (ver ADR 0007): a lista de colunas não inclui op.id, só opa.id (o agrupamento).
// Quando duas ordens de pagamento distintas do mesmo agrupamento coincidem em valor, DISTINCT
// as colapsava em uma só, subcontando o total de Consolidado e Movimentação Financeira.
const buildGroupedQuery = (params: NovoRemessaBaseParams, source: AgrupamentoSource) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT
      da."dataVencimento" AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ${source.valorSelect},
      CASE
        WHEN oph."statusRemessa" = 5
          AND opa."ordemPagamentoAgrupadoId" IS NOT NULL
          THEN op_pai."dataPagamento"
        ELSE opa."dataPagamento"
      END AS "dataPagamento",
      ${STATUS_CASE} AS status,
      ${buildCodigoErroSql(STATUS_CASE)} AS "codigoErro"
    FROM ordem_pagamento op
    INNER JOIN ordem_pagamento_agrupado opa
      ON op."${source.agrupamentoJoinColumn}" = opa.id
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
      ${source.extraWhere ? `${source.extraWhere}\n      AND ` : ''}da."dataVencimento"::date BETWEEN $1::date AND $2::date
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR ${STATUS_CASE} = ANY($4))
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND NOT EXISTS (
        SELECT 1
        FROM ordem_pagamento_agrupado filha
        WHERE filha."ordemPagamentoAgrupadoId" = opa.id
      )
      AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
      ${umaOrdemPorAgrupamentoFilter(source)}
      ${params.todosVanzeiros ? NOT_CPF_FILTER : ''}
  `;
};

// Sem DISTINCT (ver ADR 0007/TD-14): a lista de colunas não inclui op.id, só opa.id.
// Duas ordens de pagamento distintas do mesmo agrupamento que coincidem em valor eram
// colapsadas em uma só, subcontando o total de Pendência Paga.
const buildPendenciaPagaTemplate = (params: NovoRemessaBaseParams, source: AgrupamentoSource) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT
      da."dataVencimento" AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ${source.valorSelect},
      CASE
        WHEN oph."statusRemessa" = 5
          AND opa."ordemPagamentoAgrupadoId" IS NOT NULL
          THEN op_pai."dataPagamento"
        ELSE opa."dataPagamento"
      END AS "dataPagamento",
      ${STATUS_CASE} AS status,
      NULL::text AS "codigoErro"
      FROM ordem_pagamento op
      INNER JOIN ordem_pagamento_agrupado opa
        ON op."${source.agrupamentoJoinColumn}" = opa.id
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
      ${source.extraWhere ? `${source.extraWhere}\n      AND ` : ''}($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND NOT EXISTS (
        SELECT 1
        FROM ordem_pagamento_agrupado filha
        WHERE filha."ordemPagamentoAgrupadoId" = opa.id
      )
      AND oph."statusRemessa" = 5
      AND (
        (
          opa."ordemPagamentoAgrupadoId" IS NOT NULL
          AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
        )
        OR (
          opa."ordemPagamentoAgrupadoId" IS NULL
          AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date
        )
      )
      AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
      ${umaOrdemPorAgrupamentoFilter(source)}
      ${params.todosVanzeiros ? NOT_CPF_FILTER : ''}
  `;
};

// O caso de exemplo original deste comentário (2026-04-02, CPF 29709920782, opa.id=253902)
// foi diagnosticado errado: não são 3 lançamentos distintos de R$12,38 que coincidem em
// valor, é 1 único lançamento (da.id=21536) com 3 ordens de pagamento filhas do mesmo
// agrupamento - o mesmo mecanismo do ADR 0011 abaixo, não o do ADR 0007. Ver ADR 0011.
const buildPendenciaPagamentoTemplate = (
  params: NovoRemessaBaseParams,
  source: AgrupamentoSource,
) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  const parentStatusCase = buildStatusCase('oph_pai');
  const requestedStatuses = params.parentErrorStatuses?.length
    ? params.parentErrorStatuses
    : ['Estorno', 'Rejeitado'];
  const requestedStatusSql = requestedStatuses.map((status) => `'${status}'`).join(', ');

  return `
    SELECT
      ${source.dataReferenciaPendenciaPagamento ?? 'op_pai."dataPagamento"'} AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ${source.valorSelect},
      opa."dataPagamento" AS "dataPagamento",
      ${parentStatusCase} AS status,
      ${buildCodigoErroSql(parentStatusCase, 'oph_pai')} AS "codigoErro"
    FROM ordem_pagamento op
    INNER JOIN ordem_pagamento_agrupado opa
      ON op."${source.agrupamentoJoinColumn}" = opa.id
    INNER JOIN ordem_pagamento_agrupado op_pai
      ON op_pai.id = opa."ordemPagamentoAgrupadoId"
    INNER JOIN ordem_pagamento_agrupado_historico oph
      ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN ordem_pagamento_agrupado_historico oph_pai
      ON oph_pai.id = (
        SELECT MAX(oph_mais_recente.id)
        FROM ordem_pagamento_agrupado_historico oph_mais_recente
        WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = op_pai.id
      )
    INNER JOIN public."user" pu
      ON pu.id = op."userId"
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      ${source.extraWhere ? `${source.extraWhere}\n      AND ` : ''}op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND ${parentStatusCase} IN (${requestedStatusSql})
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND (oph_pai."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph_pai."motivoStatusRemessa" IS NULL)
      ${umaOrdemPorAgrupamentoFilter(source)}
      ${params.todosVanzeiros ? NOT_CPF_FILTER : ''}

    UNION ALL

    -- Estorno/Rejeitado sem pai (nunca tiveram uma tentativa anterior/retentativa): a família
    -- acima exige opa."ordemPagamentoAgrupadoId" via INNER JOIN, então esses registros de
    -- primeiro nível ficavam de fora do filtro de dia único (apareciam só em intervalos de
    -- mais de um dia, via buildBaseQuery). Aqui usamos a própria data/status do registro.
    -- Sem DISTINCT (mesmo raciocínio do ADR 0007): a lista de colunas não inclui op.id, só
    -- opa.id, e duas ordens de pagamento distintas do mesmo agrupamento podem coincidir em
    -- todos os outros campos - DISTINCT as colapsaria em uma só, subcontando o total.
    SELECT
      ${source.dataReferenciaPendenciaPagamento ?? 'opa."dataPagamento"'} AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ${source.valorSelect},
      opa."dataPagamento" AS "dataPagamento",
      ${STATUS_CASE} AS status,
      ${buildCodigoErroSql(STATUS_CASE)} AS "codigoErro"
    FROM ordem_pagamento op
    INNER JOIN ordem_pagamento_agrupado opa
      ON op."${source.agrupamentoJoinColumn}" = opa.id
    INNER JOIN ordem_pagamento_agrupado_historico oph
      ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN public."user" pu
      ON pu.id = op."userId"
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      ${source.extraWhere ? `${source.extraWhere}\n      AND ` : ''}opa."ordemPagamentoAgrupadoId" IS NULL
      AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND ${STATUS_CASE} IN (${requestedStatusSql})
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND NOT EXISTS (
        SELECT 1
        FROM ordem_pagamento_agrupado filha
        WHERE filha."ordemPagamentoAgrupadoId" = opa.id
      )
      AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
      ${umaOrdemPorAgrupamentoFilter(source)}
      ${params.todosVanzeiros ? NOT_CPF_FILTER : ''}
  `;
};

export const buildBaseQuery = (params: NovoRemessaBaseParams) => buildGroupedQuery(params, AGRUPAMENTO_NORMAL);

export const buildEleicaoQuery = (params: NovoRemessaBaseParams) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT DISTINCT
      da."dataVencimento" AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj",
      opu."consorcio" AS "nomeConsorcio",
      da."valorLancamento" AS valor,
      da."dataVencimento" AS "dataPagamento",
      ${ELEICAO_STATUS_CASE} AS status,
      ${buildCodigoErroSql(ELEICAO_STATUS_CASE)} AS "codigoErro"
    FROM
      ordem_pagamento_agrupado opa
    INNER JOIN ordem_pagamento_agrupado_historico oph
      ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN ordem_pagamento_unico opu
      ON opu."idOrdemPagamento" = opa.id::VARCHAR
    INNER JOIN public."user" pu
      ON pu."cpfCnpj" = opu."operadoraCpfCnpj"
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      da."dataVencimento"::date BETWEEN $1::date AND $2::date
      AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
      AND ${ELEICAO_STATUS_FILTER}
      AND (${consorcioParam}::text[] IS NULL OR TRIM(UPPER(opu."consorcio")) = ANY(${consorcioParam}))      
      ${params.todosVanzeiros ? NOT_CPF_FILTER : ''}
  `;
};

export const buildStucGratuidadeQuery = (params: NovoRemessaBaseParams) => buildGroupedQuery(params, AGRUPAMENTO_GRATUIDADE);

export const buildPendentesQuery = (params: NovoRemessaPendentesParams) => {
  return `
    SELECT DISTINCT
      DATE(op."dataOrdem") AS "dataReferencia",
      NULL::integer AS id,
      op."nomeOperadora" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      op.valor AS valor,
      op."dataOrdem" AS "dataPagamento",
      '${StatusPagamento.PENDENTES}' AS status,
      NULL::text AS "codigoErro"
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
      AND UPPER(TRIM(${CONSORCIO_CASE})) = ANY(
        COALESCE(NULLIF($5::text[], '{}'), ARRAY['STPC','STPL','TEC'])
      )
      AND (
        ($6::numeric IS NULL OR op.valor >= $6::numeric)
        AND ($7::numeric IS NULL OR op.valor <= $7::numeric)
      )
      ${params.todosVanzeiros ? NOT_CPF_FILTER : ''}
  `;
};

export const buildPendenciaPagaSingleDateQuery = (params: NovoRemessaBaseParams) =>
  buildPendenciaPagaTemplate(params, AGRUPAMENTO_NORMAL);

// Filhas PASSO 0: pendências pagas (status 5) que nunca foram enviadas em arquivo próprio, então
// nenhum histórico delas tem detalhe_a e o INNER JOIN de buildPendenciaPagaTemplate as descarta.
// Valor = valorTotal da OPA da filha (cada filha tem de 1 a N ordem_pagamento que somam esse
// valor, então só a ordem de menor id representa a filha) e data = dataPagamento da pai.
// Fica numa consulta separada, e não num UNION ALL dentro do template, porque o service anexa
// "AND pu.bloqueado = true" ao final do SQL de cada consulta.
export const buildPendenciaPagaPasso0Query = (params: NovoRemessaBaseParams) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT
      oph."dataReferencia" AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ROUND(opa."valorTotal"::numeric, 2) AS valor,
      op_pai."dataPagamento" AS "dataPagamento",
      'Pendencia Paga' AS status,
      NULL::text AS "codigoErro"
      FROM ordem_pagamento op
      INNER JOIN ordem_pagamento_agrupado opa
        ON op."ordemPagamentoAgrupadoId" = opa.id
      INNER JOIN ordem_pagamento_agrupado op_pai
        ON op_pai.id = opa."ordemPagamentoAgrupadoId"
      INNER JOIN ordem_pagamento_agrupado_historico oph
        ON oph.id = (
          SELECT MAX(oph_mais_recente.id)
          FROM ordem_pagamento_agrupado_historico oph_mais_recente
          WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = opa.id
        )
      INNER JOIN public."user" pu
        ON pu.id = op."userId"
      INNER JOIN bank bc
        ON bc.code = pu."bankCode"
    WHERE
      ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND NOT EXISTS (
        SELECT 1
        FROM ordem_pagamento_agrupado filha
        WHERE filha."ordemPagamentoAgrupadoId" = opa.id
      )
      AND oph."statusRemessa" = 5
      AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
      AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM ordem_pagamento_agrupado_historico oph_qualquer
        INNER JOIN detalhe_a da_qualquer
          ON da_qualquer."ordemPagamentoAgrupadoHistoricoId" = oph_qualquer.id
        WHERE oph_qualquer."ordemPagamentoAgrupadoId" = opa.id
      )
      ${umaOrdemPorAgrupamentoFilter(AGRUPAMENTO_NORMAL)}
      ${params.todosVanzeiros ? NOT_CPF_FILTER : ''}
  `;
};

export const buildStucGratuidadePendenciaPagaSingleDateQuery = (params: NovoRemessaBaseParams) =>
  buildPendenciaPagaTemplate(params, AGRUPAMENTO_GRATUIDADE);

export const buildStucGratuidadePendenciaPagamentoSingleDateQuery = (params: NovoRemessaBaseParams) =>
  buildPendenciaPagamentoTemplate(params, AGRUPAMENTO_GRATUIDADE);

export const buildPendenciaPagamentoSingleDateQuery = (params: NovoRemessaBaseParams) =>
  buildPendenciaPagamentoTemplate(params, AGRUPAMENTO_NORMAL);
