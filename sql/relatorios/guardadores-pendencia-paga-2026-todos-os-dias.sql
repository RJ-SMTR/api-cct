-- Relatório de movimentação financeira — guardadores
-- Guardadores com status "Pendencia Paga" em qualquer dia de 2026, agrupados por mês e data de pagamento.
-- Somente leitura (SELECT). Executar apenas com autorização explícita em produção.
--
-- Observações:
--   * "guardador" é pu."roleId" = 6 (mesmo critério do relatório de guardadores da aplicação).
--   * Associações (SINGAERJ, ANGLAE) não entram: não têm roleId 6.
--   * A data de pagamento usada é a da ordem (ou da ordem pai, quando existe), como no relatório com data única.
--   * Ordens agrupadas que têm filhas não aparecem, como na aplicação.
--   * Não aplica filtros de consórcio, favorecido, desativados nem faixa de valor.
--   * Diferente da versão de primeiras quintas, não limita a data às primeiras quintas-feiras.

WITH pendencia_paga AS (
  SELECT DISTINCT
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
  WHERE oph."statusRemessa" = 5                       -- Pendencia Paga
    AND pu."roleId" = 6                               -- guardador
    AND opa.id NOT IN (
      SELECT filha."ordemPagamentoAgrupadoId"
      FROM ordem_pagamento_agrupado filha
      WHERE filha."ordemPagamentoAgrupadoId" IS NOT NULL
    )
    AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
    AND (CASE
          WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN op_pai."dataPagamento"
          ELSE opa."dataPagamento"
        END)::date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
)
SELECT
  date_trunc('month', "dataPagamento")::date AS mes,
  "dataPagamento"::date AS "dataPagamento",
  to_char("dataPagamento", 'Dy') AS dia_semana,
  'Pendencia Paga' AS status,
  COUNT(*) AS linhas,
  SUM(valor) AS total
FROM pendencia_paga
GROUP BY 1, 2, 3
ORDER BY 1, 2;
