-- Relatório de movimentação financeira — perfil permissionário
-- Favorecidos com status "Pendentes" (ordens ainda não agrupadas) em cada primeira quinta-feira do mês de 2026.
-- Somente leitura (SELECT). Executar apenas com autorização explícita em produção.
--
-- Observações:
--   * "perfil permissionário" é aproximado por pu."permitCode" IS NOT NULL.
--   * A data de referência é DATE(op."dataOrdem"), como no relatório de pendentes.
--   * Não aplica filtros de consórcio, usuário, todosVanzeiros ou desativados.
--     O relatório da aplicação, sem filtro de consórcio, considera só STPC, STPL e TEC em pendentes.
--   * Novembro e dezembro são datas futuras (a partir de 06/10/2026) e tendem a não retornar linhas.

WITH primeiras_quintas AS (
  -- primeira quinta-feira de cada mês (DOW: domingo = 0, quinta = 4)
  SELECT (m + ((4 - EXTRACT(DOW FROM m)::int + 7) % 7) * INTERVAL '1 day')::date AS data_quinta
  FROM generate_series(DATE '2026-01-01', DATE '2026-12-01', INTERVAL '1 month') AS m
),
pendentes AS (
  SELECT
    q.data_quinta AS "primeiraQuinta",
    op."dataOrdem" AS "dataPagamento",
    op.valor AS valor
  FROM ordem_pagamento op
  INNER JOIN public."user" pu
    ON pu.id = op."userId"
  INNER JOIN bank bc
    ON bc.code = pu."bankCode"
  INNER JOIN primeiras_quintas q
    ON DATE(op."dataOrdem") = q.data_quinta
  WHERE op."ordemPagamentoAgrupadoId" IS NULL         -- status Pendentes
    AND pu."permitCode" IS NOT NULL                   -- perfil permissionário
)
SELECT
  'Permissionário' AS perfil,
  "dataPagamento",
  'Pendentes' AS status,
  SUM(valor) AS total
FROM pendentes
GROUP BY "dataPagamento"
ORDER BY "dataPagamento";
