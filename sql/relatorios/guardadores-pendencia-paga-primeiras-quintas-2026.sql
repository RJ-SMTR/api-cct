-- Relatório de movimentação financeira — guardadores
-- Guardadores com status "Pendencia Paga" em cada primeira quinta-feira do mês de 2026.
-- Somente leitura (SELECT). Executar apenas com autorização explícita em produção.
--
-- Observações:
--   * "guardador" é pu."roleId" = 6 (mesmo critério do relatório de guardadores da aplicação).
--   * Associações (SINGAERJ, ANGLAE) não entram: não têm roleId 6.
--   * A data de pagamento usada é a da ordem (ou da ordem pai, quando existe), como no relatório com data única.
--   * Ordens agrupadas que têm filhas não aparecem, como na aplicação.
--   * Não aplica filtros de consórcio, favorecido, desativados nem faixa de valor.
--   * Novembro e dezembro são datas futuras (a partir de 06/10/2026) e tendem a não retornar linhas.

WITH primeiras_quintas AS (
  -- primeira quinta-feira de cada mês (DOW: domingo = 0, quinta = 4)
  SELECT (m + ((4 - EXTRACT(DOW FROM m)::int + 7) % 7) * INTERVAL '1 day')::date AS data_quinta
  FROM generate_series(DATE '2026-01-01', DATE '2026-12-01', INTERVAL '1 month') AS m
),
pendencia_paga AS (
  SELECT DISTINCT
    q.data_quinta AS "primeiraQuinta",
    opa.id,
    pu."fullName" AS nomes,
    da."valorLancamento" AS valor,
    CASE
      WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN op_pai."dataPagamento"
      ELSE opa."dataPagamento"
    END AS "dataPagamento"
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
  INNER JOIN primeiras_quintas q
    ON (CASE
          WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN op_pai."dataPagamento"
          ELSE opa."dataPagamento"
        END)::date = q.data_quinta
  WHERE oph."statusRemessa" = 5                       -- Pendencia Paga
    AND pu."roleId" = 6                               -- guardador
    AND opa.id NOT IN (
      SELECT filha."ordemPagamentoAgrupadoId"
      FROM ordem_pagamento_agrupado filha
      WHERE filha."ordemPagamentoAgrupadoId" IS NOT NULL
    )
    AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
)
SELECT
  "primeiraQuinta" AS mes,
  "dataPagamento",
  'Pendencia Paga' AS status,
  SUM(valor) AS total
FROM pendencia_paga
GROUP BY "primeiraQuinta", "dataPagamento"
ORDER BY "primeiraQuinta", "dataPagamento";
