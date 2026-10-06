-- Relatório de movimentação financeira — perfil permissionário
-- Favorecidos com status "Pendencia Paga" em cada primeira quinta-feira do mês de 2026.
-- Somente leitura (SELECT). Executar apenas com autorização explícita em produção.
--
-- Observações:
--   * "perfil permissionário" é aproximado por pu."permitCode" IS NOT NULL.
--   * Não aplica filtros de consórcio, usuário, todosVanzeiros ou desativados.
--   * Novembro e dezembro são datas futuras (a partir de 06/10/2026) e tendem a não retornar linhas.

WITH primeiras_quintas AS (
  -- primeira quinta-feira de cada mês (DOW: domingo = 0, quinta = 4)
  SELECT (m + ((4 - EXTRACT(DOW FROM m)::int + 7) % 7) * INTERVAL '1 day')::date AS data_quinta
  FROM generate_series(DATE '2026-01-01', DATE '2026-12-01', INTERVAL '1 month') AS m
),
pendencia_paga AS (
  SELECT DISTINCT
    q.data_quinta AS "primeiraQuinta",
    da."dataVencimento" AS "dataReferencia",
    opa.id,
    pu."fullName" AS nomes,
    pu.email,
    pu."bankCode" AS "codBanco",
    bc.name AS "nomeBanco",
    pu."cpfCnpj" AS "cpfCnpj",
    CASE
      WHEN pu."permitCode" = '8' THEN 'VLT'
      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
      ELSE op."nomeConsorcio"
    END AS "nomeConsorcio",
    da."valorLancamento" AS valor,
    CASE
      WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN op_pai."dataPagamento"
      ELSE opa."dataPagamento"
    END AS "dataPagamento"
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
  INNER JOIN primeiras_quintas q
    ON (CASE
          WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN op_pai."dataPagamento"
          ELSE opa."dataPagamento"
        END)::date = q.data_quinta
  WHERE oph."statusRemessa" = 5                       -- Pendencia Paga
    AND pu."permitCode" IS NOT NULL                   -- perfil permissionário
    AND NOT EXISTS (
      SELECT 1
      FROM ordem_pagamento_agrupado filha
      WHERE filha."ordemPagamentoAgrupadoId" = opa.id
    )
    AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
)
SELECT
  'Permissionário' AS perfil,
  "dataPagamento",
  'Pendencia Paga' AS status,
  SUM(valor) AS total
FROM pendencia_paga
GROUP BY "dataPagamento"
ORDER BY "dataPagamento";
