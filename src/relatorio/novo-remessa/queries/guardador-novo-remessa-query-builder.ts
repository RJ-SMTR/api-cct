export type GuardadorBaseQueryParams = {
  desativados?: boolean;
  consorcioFilterParamIndex?: number;
  favorecidoFilterParamIndex?: number;
  todosConsorcios?: boolean;
};

export const GUARDADOR_STATUS_CASE = `
  CASE
    WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;

export const GUARDADOR_CONSORCIO_CASE = `
  CASE
    WHEN pu."permitCode" IS NULL THEN pu."fullName"
    ELSE COALESCE(assoc."fullName", 'Guardador Autônomo')
  END
`;

// public."user"."roleId" of a guardador. Associations (SINGAERJ, ANGLAE) also have
// rows in ordem_pagamento_guardador but are not guardadores.
const GUARDADOR_ROLE_ID = 6;

// "Data Tentativa Pagamento". A Pendencia Paga without a parent order is a pending payment
// that was regrouped into a single OPA, so it shows the oldest dataOrdem of its opg rows
// (the first attempt); every other row keeps the vencimento of the detalhe_a.
const GUARDADOR_DATA_REFERENCIA = `
      CASE
        WHEN oph."statusRemessa" = 5
          AND opa."ordemPagamentoAgrupadoId" IS NULL
          THEN (
            SELECT MIN(g."dataOrdem")
            FROM ordem_pagamento_guardador g
            WHERE g."ordemPagamentoAgrupadoId" = opa.id
          )::timestamp
        ELSE da."dataVencimento"
      END`;

// Orders that were regrouped under a parent have children and are not listed themselves.
// The uncorrelated NOT IN is evaluated once, as a hashed SubPlan. The correlated NOT EXISTS
// let the planner pick a nested-loop anti join that scans the ~280k ordem_pagamento_agrupado
// rows once per outer row whenever a filter (status, consorcio) made it underestimate the
// rows, which took 30s+ per query.
const GUARDADOR_OPA_WITHOUT_CHILDREN = `opa.id NOT IN (
        SELECT filha."ordemPagamentoAgrupadoId"
        FROM ordem_pagamento_agrupado filha
        WHERE filha."ordemPagamentoAgrupadoId" IS NOT NULL
      )`;

// A guardador can be linked to more than one association. Joining user_relationships
// directly would yield one row (and repeat the value) per association, so they are
// aggregated once per user (GROUP BY user_id) and joined on that key: one row per payment.
// "fullName" lists all of them for display (the front shortens each name). The CTE is
// MATERIALIZED so it is computed exactly once whatever plan is chosen: a per-row LATERAL
// scanned user_relationships once per payment, and a plain aggregated join was re-run per
// row when a filter made the planner underestimate.
// Each builder returns a parenthesized select so it stays valid inside UNION ALL and CTEs.
const GUARDADOR_ASSOCIACAO_CTE = `WITH assoc AS MATERIALIZED (
      SELECT
        ur.user_id,
        STRING_AGG(a."fullName", ' / ' ORDER BY a."fullName") AS "fullName"
      FROM user_relationships ur
      INNER JOIN public."user" a
        ON a.id = ur.related_user_id
      WHERE a."fullName" IS NOT NULL
      GROUP BY ur.user_id
    )`;

const GUARDADOR_ASSOCIACAO_JOIN = `LEFT JOIN assoc
      ON assoc.user_id = pu.id`;

// Associations (SINGAERJ, ANGLAE) are payees in ordem_pagamento_guardador too, with their
// own "user" row: roleId 1 (not GUARDADOR_ROLE_ID) and no permitCode (every guardador has
// one). The default view (no consorcio selected) keeps to actual guardadores, so it still
// requires the guardador role. Selecting a consorcio switches to that association's own
// payment instead — its roleId does not matter, only that it is the association itself
// (permitCode IS NULL) with a matching name, so the guardador-role check does not apply
// there. todosConsorcios shows every association's own payment the same way, regardless
// of name, and also without requiring the guardador role.
const buildConsorcioFilter = (consorcioParam: string, todosConsorcios?: boolean) => {
  if (todosConsorcios) {
    // $6/$7 are bound further down, so Postgres still expects a type for $5 even though it
    // is not a real filter here — reference it as a no-op (always true) so it can infer
    // ::text[]. Dropping it entirely raises "could not determine data type of parameter $5"
    // and fails the whole query.
    return `(${consorcioParam}::text[] IS NULL OR ${consorcioParam}::text[] IS NOT NULL) AND pu."permitCode" IS NULL`;
  }

  return `(
    (${consorcioParam}::text[] IS NULL AND pu."roleId" = ${GUARDADOR_ROLE_ID})
    OR (${consorcioParam}::text[] IS NOT NULL AND pu."permitCode" IS NULL AND UPPER(TRIM(pu."fullName")) = ANY(${consorcioParam}::text[]))
  )`;
};

export const buildGuardadorBaseQuery = (params: GuardadorBaseQueryParams = {}) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex ?? 5}`;
  const favorecidoClause = params.favorecidoFilterParamIndex
    ? `AND ($${params.favorecidoFilterParamIndex}::text[] IS NULL OR UPPER(TRIM(pu."fullName")) = ANY($${params.favorecidoFilterParamIndex}))`
    : '';

  return `(${GUARDADOR_ASSOCIACAO_CTE}
    SELECT DISTINCT
      ${GUARDADOR_DATA_REFERENCIA} AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      COALESCE(pu.email, '') AS email,
      pu."bankCode" AS "codBanco",
      COALESCE(bc.name, '') AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${GUARDADOR_CONSORCIO_CASE} AS "nomeConsorcio",
      da."valorLancamento" AS valor,
      CASE
        WHEN oph."statusRemessa" = 5
          AND opa."ordemPagamentoAgrupadoId" IS NOT NULL
          THEN op_pai."dataPagamento"
        ELSE opa."dataPagamento"
      END AS "dataPagamento",
      ${GUARDADOR_STATUS_CASE} AS status
    FROM ordem_pagamento_guardador opg
    INNER JOIN ordem_pagamento_agrupado opa
      ON opg."ordemPagamentoAgrupadoId" = opa.id
    LEFT JOIN ordem_pagamento_agrupado op_pai
      ON op_pai.id = opa."ordemPagamentoAgrupadoId"
    INNER JOIN ordem_pagamento_agrupado_historico oph
      ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN public."user" pu
      ON pu.id = opg."userId"
    LEFT JOIN bank bc
      ON bc.code = pu."bankCode"
    ${GUARDADOR_ASSOCIACAO_JOIN}
    WHERE
      da."dataVencimento" BETWEEN $1 AND $2
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR ${GUARDADOR_STATUS_CASE} = ANY($4))
      AND ${buildConsorcioFilter(consorcioParam, params.todosConsorcios)}
      AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric)
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
      )
      AND ${GUARDADOR_OPA_WITHOUT_CHILDREN}
      AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
      ${favorecidoClause}
      ${params.desativados ? 'AND pu.bloqueado = true' : ''}
  )`.trim();
};

export const buildGuardadorAPagarQuery = (params: GuardadorBaseQueryParams = {}) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex ?? 5}`;
  const favorecidoClause = params.favorecidoFilterParamIndex
    ? `AND ($${params.favorecidoFilterParamIndex}::text[] IS NULL OR UPPER(TRIM(pu."fullName")) = ANY($${params.favorecidoFilterParamIndex}))`
    : '';

  return `(${GUARDADOR_ASSOCIACAO_CTE}
    SELECT DISTINCT
      opg."dataOrdem" AS "dataReferencia",
      NULL::integer AS id,
      pu."fullName" AS nomes,
      COALESCE(pu.email, '') AS email,
      pu."bankCode" AS "codBanco",
      COALESCE(bc.name, '') AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${GUARDADOR_CONSORCIO_CASE} AS "nomeConsorcio",
      ROUND(opg."valorRepasseGuardador"::numeric, 2) AS valor,
      opg."dataOrdem" AS "dataPagamento",
      'A Pagar' AS status
    FROM ordem_pagamento_guardador opg
    INNER JOIN public."user" pu
      ON pu.id = opg."userId"
    LEFT JOIN bank bc
      ON bc.code = pu."bankCode"
    ${GUARDADOR_ASSOCIACAO_JOIN}
    WHERE
      opg."ordemPagamentoAgrupadoId" IS NULL
      AND opg."dataOrdem" BETWEEN $1 AND $2
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR 'A Pagar' = ANY($4))
      AND ${buildConsorcioFilter(consorcioParam, params.todosConsorcios)}
      AND (
        ($6::numeric IS NULL OR opg."valorRepasseGuardador" >= $6::numeric)
        AND ($7::numeric IS NULL OR opg."valorRepasseGuardador" <= $7::numeric)
      )
      ${favorecidoClause}
      ${params.desativados ? 'AND pu.bloqueado = true' : ''}
  )`.trim();
};

export const buildGuardadorPendenciaPagaSingleDateQuery = (params: GuardadorBaseQueryParams = {}) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex ?? 5}`;
  const favorecidoClause = params.favorecidoFilterParamIndex
    ? `AND ($${params.favorecidoFilterParamIndex}::text[] IS NULL OR UPPER(TRIM(pu."fullName")) = ANY($${params.favorecidoFilterParamIndex}))`
    : '';

  return `(${GUARDADOR_ASSOCIACAO_CTE}
    SELECT DISTINCT
      ${GUARDADOR_DATA_REFERENCIA} AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      COALESCE(pu.email, '') AS email,
      pu."bankCode" AS "codBanco",
      COALESCE(bc.name, '') AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${GUARDADOR_CONSORCIO_CASE} AS "nomeConsorcio",
      da."valorLancamento" AS valor,
      CASE
        WHEN oph."statusRemessa" = 5
          AND opa."ordemPagamentoAgrupadoId" IS NOT NULL
          THEN op_pai."dataPagamento"
        ELSE opa."dataPagamento"
      END AS "dataPagamento",
      ${GUARDADOR_STATUS_CASE} AS status
    FROM ordem_pagamento_guardador opg
    INNER JOIN ordem_pagamento_agrupado opa
      ON opg."ordemPagamentoAgrupadoId" = opa.id
    LEFT JOIN ordem_pagamento_agrupado op_pai
      ON op_pai.id = opa."ordemPagamentoAgrupadoId"
    INNER JOIN ordem_pagamento_agrupado_historico oph
      ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN public."user" pu
      ON pu.id = opg."userId"
    LEFT JOIN bank bc
      ON bc.code = pu."bankCode"
    ${GUARDADOR_ASSOCIACAO_JOIN}
    WHERE
      ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND ${buildConsorcioFilter(consorcioParam, params.todosConsorcios)}
      AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric)
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
      )
      AND ${GUARDADOR_OPA_WITHOUT_CHILDREN}
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
      ${favorecidoClause}
      ${params.desativados ? 'AND pu.bloqueado = true' : ''}
  )`.trim();
};
