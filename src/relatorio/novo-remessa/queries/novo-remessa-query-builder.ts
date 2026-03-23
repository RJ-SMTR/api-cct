import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';

export type NovoRemessaBaseParams = {
  todosVanzeiros?: boolean;
  consorcioFilterParamIndex: number;
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

export const buildBaseQuery = (params: NovoRemessaBaseParams) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT DISTINCT
      da."dataVencimento" AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      da."valorLancamento" AS valor,
      CASE
        WHEN oph."statusRemessa" = 5
          AND opa."ordemPagamentoAgrupadoId" IS NOT NULL
          THEN op_pai."dataPagamento"
        ELSE opa."dataPagamento"
      END AS "dataPagamento",
      ${STATUS_CASE} AS status
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
      AND ($4::text[] IS NULL OR ${STATUS_CASE} = ANY($4))
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
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
      ${params.todosVanzeiros ? NOT_CPF_FILTER : ''}
  `;
};

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
      '${StatusPagamento.PENDENTES}' AS status
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

