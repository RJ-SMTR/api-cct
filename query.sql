WITH
    historico_recente AS (
        SELECT DISTINCT
            ON ("ordemPagamentoAgrupadoId") *
        FROM
            ordem_pagamento_agrupado_historico
        ORDER BY
            "ordemPagamentoAgrupadoId",
            "dataReferencia" DESC
    ),
 dias_base AS (
    SELECT
        dias::DATE AS data,
        EXTRACT(DOW FROM dias) AS dow
    FROM generate_series(
        DATE_TRUNC('month', '2026-02-01'::DATE),
        DATE_TRUNC('month', '2026-02-01'::DATE) + INTERVAL '1 month' - INTERVAL '1 day',
        '1 day'::INTERVAL
    ) AS dias
),
 dias_relatorio AS (
    SELECT data
    FROM dias_base
    WHERE
        (
            EXTRACT(YEAR FROM data) = 2026
            AND (
                dow IN (2, 5)
            )
        )
)
SELECT
   dr.data,
    SUM(dp.valor) AS valor,
    MIN(dp."valorTotal") AS valor_total_agrupado,
    (dr.data - 1) AS data_final_operacoes,
    (dr.data - 7) AS data_inicial_operacoes,
    dp."dataReferencia",
    dp.opa_id AS opaId,
    dp."statusRemessa",
    dp."motivoStatusRemessa",
    dp.data_pagamento,
    dp.opa_origem_id
FROM
    dias_relatorio dr
   LEFT JOIN LATERAL (
        SELECT
            op.valor,
            opa."valorTotal",
            CASE
                WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN opa_pai."dataPagamento"
                ELSE opa."dataPagamento"
            END as "dataReferencia",
            oph."statusRemessa",
            oph."motivoStatusRemessa",
     		opa.id AS opa_id,
            opa."dataPagamento" AS data_pagamento,
            opa."ordemPagamentoAgrupadoId" AS opa_origem_id
        FROM
            ordem_pagamento op
            JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
            LEFT JOIN ordem_pagamento_agrupado opa_pai ON opa."ordemPagamentoAgrupadoId" = opa_pai.id
            JOIN historico_recente oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        WHERE
            op."userId" = 2270
            AND (
            opa."dataPagamento"::DATE = dr.data

OR (

                    opa."ordemPagamentoAgrupadoId" IS NULL

                and    op."dataOrdem"::DATE BETWEEN (
    dr.data - CASE
        WHEN EXTRACT(
            MONTH
            FROM dr.data
        ) >= 9 THEN 3
        ELSE 7
    END
) AND (dr.data - 1)
                    AND oph."statusRemessa" NOT IN (3, 4)
                    AND opa."dataPagamento"::DATE > dr.data
                )
            )
    ) dp ON TRUE
GROUP BY
    dr.data,
    dp.data_pagamento,
    dp.opa_origem_id,
    dp.opa_id,
    dp."dataReferencia",
    dp."statusRemessa",
    dp."motivoStatusRemessa"
ORDER BY dr.data;
