export type GuardadorBaseQueryParams = {
  desativados?: boolean;
  consorcioFilterParamIndex?: number;
  favorecidoFilterParamIndex?: number;
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

export const buildGuardadorBaseQuery = (params: GuardadorBaseQueryParams = {}) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex ?? 5}`;
  const favorecidoClause = params.favorecidoFilterParamIndex
    ? `AND ($${params.favorecidoFilterParamIndex}::text[] IS NULL OR UPPER(TRIM(pu."fullName")) = ANY($${params.favorecidoFilterParamIndex}))`
    : '';

  return `
    SELECT DISTINCT
      da."dataVencimento" AS "dataReferencia",
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
    LEFT JOIN user_relationships ur
      ON ur.user_id = pu.id
    LEFT JOIN public."user" assoc
      ON assoc.id = ur.related_user_id
    WHERE
      da."dataVencimento" BETWEEN $1 AND $2
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR ${GUARDADOR_STATUS_CASE} = ANY($4))
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${GUARDADOR_CONSORCIO_CASE})) = ANY(${consorcioParam}))
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
      ${favorecidoClause}
      ${params.desativados ? 'AND pu.bloqueado = true' : ''}
  `.trim();
};

export const buildGuardadorAPagarQuery = (params: GuardadorBaseQueryParams = {}) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex ?? 5}`;
  const favorecidoClause = params.favorecidoFilterParamIndex
    ? `AND ($${params.favorecidoFilterParamIndex}::text[] IS NULL OR UPPER(TRIM(pu."fullName")) = ANY($${params.favorecidoFilterParamIndex}))`
    : '';

  return `
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
    LEFT JOIN user_relationships ur
      ON ur.user_id = pu.id
    LEFT JOIN public."user" assoc
      ON assoc.id = ur.related_user_id
    WHERE
      opg."ordemPagamentoAgrupadoId" IS NULL
      AND opg."dataOrdem" BETWEEN $1 AND $2
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR 'A Pagar' = ANY($4))
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${GUARDADOR_CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND (
        ($6::numeric IS NULL OR opg."valorRepasseGuardador" >= $6::numeric)
        AND ($7::numeric IS NULL OR opg."valorRepasseGuardador" <= $7::numeric)
      )
      ${favorecidoClause}
      ${params.desativados ? 'AND pu.bloqueado = true' : ''}
  `.trim();
};

export const buildGuardadorPendenciaPagaSingleDateQuery = (params: GuardadorBaseQueryParams = {}) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex ?? 5}`;
  const favorecidoClause = params.favorecidoFilterParamIndex
    ? `AND ($${params.favorecidoFilterParamIndex}::text[] IS NULL OR UPPER(TRIM(pu."fullName")) = ANY($${params.favorecidoFilterParamIndex}))`
    : '';

  return `
    SELECT DISTINCT
      da."dataVencimento" AS "dataReferencia",
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
    LEFT JOIN user_relationships ur
      ON ur.user_id = pu.id
    LEFT JOIN public."user" assoc
      ON assoc.id = ur.related_user_id
    WHERE
      ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${GUARDADOR_CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND (
        ($6::numeric IS NULL OR da."valorLancamento" >= $6::numeric)
        AND ($7::numeric IS NULL OR da."valorLancamento" <= $7::numeric)
      )
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
      ${favorecidoClause}
      ${params.desativados ? 'AND pu.bloqueado = true' : ''}
  `.trim();
};
