-- Monthly dashboard view
-- Params:
--   $1 = month in YYYY-MM
--   $2 = userId
WITH latest_history AS (
  SELECT DISTINCT ON (oph."ordemPagamentoAgrupadoId")
    oph."ordemPagamentoAgrupadoId",
    oph."statusRemessa",
    oph."motivoStatusRemessa"
  FROM ordem_pagamento_agrupado_historico oph
  ORDER BY oph."ordemPagamentoAgrupadoId", oph.id DESC
)
SELECT
  TO_CHAR(opa."dataPagamento", 'YYYY-MM-DD') AS "paymentDate",
  SUM(opg."qtdVerificacaoTotal") AS "qtdVerificacaoTotal",
  SUM(opg."qtdVerificacaoValida") AS "qtdVerificacaoValida",
  SUM(opg."qtdVerificacaoInvalida") AS "qtdVerificacaoInvalida",
  ROUND(MAX(opa."valorTotal")::numeric, 2) AS "valorTotal",
  latest_history."statusRemessa" AS "statusRemessa",
  latest_history."motivoStatusRemessa" AS "motivoStatusRemessa"
FROM ordem_pagamento_guardador opg
INNER JOIN ordem_pagamento_agrupado opa
  ON opa.id = opg."ordemPagamentoAgrupadoId"
LEFT JOIN latest_history
  ON latest_history."ordemPagamentoAgrupadoId" = opa.id
WHERE opg."ordemPagamentoAgrupadoId" IS NOT NULL
  AND TO_CHAR(opa."dataPagamento", 'YYYY-MM') = $1
  AND opg."userId" = $2
GROUP BY
  opa."dataPagamento",
  latest_history."statusRemessa",
  latest_history."motivoStatusRemessa"
ORDER BY opa."dataPagamento" DESC;

-- Weekly dashboard view
-- Params:
--   $1 = month in YYYY-MM
--   $2 = userId
--   $3 = paymentDate in YYYY-MM-DD or null
WITH latest_history AS (
  SELECT DISTINCT ON (oph."ordemPagamentoAgrupadoId")
    oph."ordemPagamentoAgrupadoId",
    oph."statusRemessa",
    oph."motivoStatusRemessa"
  FROM ordem_pagamento_agrupado_historico oph
  ORDER BY oph."ordemPagamentoAgrupadoId", oph.id DESC
)
SELECT
  TO_CHAR(opa."dataPagamento", 'YYYY-MM-DD') AS "paymentDate",
  TO_CHAR(opg."dataInclusao", 'YYYY-MM-DD') AS "workDate",
  SUM(opg."qtdVerificacaoTotal") AS "qtdVerificacaoTotal",
  SUM(opg."qtdVerificacaoValida") AS "qtdVerificacaoValida",
  SUM(opg."qtdVerificacaoInvalida") AS "qtdVerificacaoInvalida",
  ROUND(SUM(opg."valorRepasseGuardador")::numeric, 2) AS "valorRepasseGuardador",
  latest_history."statusRemessa" AS "statusRemessa",
  latest_history."motivoStatusRemessa" AS "motivoStatusRemessa"
FROM ordem_pagamento_guardador opg
INNER JOIN ordem_pagamento_agrupado opa
  ON opa.id = opg."ordemPagamentoAgrupadoId"
LEFT JOIN latest_history
  ON latest_history."ordemPagamentoAgrupadoId" = opa.id
WHERE opg."ordemPagamentoAgrupadoId" IS NOT NULL
  AND TO_CHAR(opa."dataPagamento", 'YYYY-MM') = $1
  AND opg."userId" = $2
  AND ($3::date IS NULL OR opa."dataPagamento" = $3::date)
GROUP BY
  opa."dataPagamento",
  opg."dataInclusao",
  latest_history."statusRemessa",
  latest_history."motivoStatusRemessa"
ORDER BY opa."dataPagamento" DESC, opg."dataInclusao" DESC;

-- Daily dashboard view
-- Params:
--   $1 = month in YYYY-MM
--   $2 = userId
--   $3 = paymentDate in YYYY-MM-DD or null
--   $4 = workDate in YYYY-MM-DD or null
WITH latest_history AS (
  SELECT DISTINCT ON (oph."ordemPagamentoAgrupadoId")
    oph."ordemPagamentoAgrupadoId",
    oph."statusRemessa",
    oph."motivoStatusRemessa"
  FROM ordem_pagamento_agrupado_historico oph
  ORDER BY oph."ordemPagamentoAgrupadoId", oph.id DESC
)
SELECT
  COALESCE(NULLIF(TRIM(opg."idOrdemPagamento"), ''), CONCAT('GUARDADOR-', opg.id::text)) AS "photoId",
  TO_CHAR(opa."dataPagamento", 'YYYY-MM-DD') AS "paymentDate",
  TO_CHAR(opg."dataInclusao", 'YYYY-MM-DD') AS "workDate",
  CONCAT(
    COALESCE(NULLIF(TRIM(opg."tipoOrdemPagamento"), ''), 'Repasse do guardador'),
    COALESCE(CONCAT(' #', NULLIF(TRIM(opg."idOrdemPagamento"), '')), '')
  ) AS description,
  ROUND(COALESCE(opg."valorRepasseGuardador", 0)::numeric, 2) AS amount,
  latest_history."statusRemessa" AS "statusRemessa",
  latest_history."motivoStatusRemessa" AS "motivoStatusRemessa"
FROM ordem_pagamento_guardador opg
INNER JOIN ordem_pagamento_agrupado opa
  ON opa.id = opg."ordemPagamentoAgrupadoId"
LEFT JOIN latest_history
  ON latest_history."ordemPagamentoAgrupadoId" = opa.id
WHERE opg."ordemPagamentoAgrupadoId" IS NOT NULL
  AND TO_CHAR(opa."dataPagamento", 'YYYY-MM') = $1
  AND opg."userId" = $2
  AND ($3::date IS NULL OR opa."dataPagamento" = $3::date)
  AND ($4::date IS NULL OR opg."dataInclusao" = $4::date)
ORDER BY opa."dataPagamento" DESC, opg."dataInclusao" DESC, opg.id DESC;
