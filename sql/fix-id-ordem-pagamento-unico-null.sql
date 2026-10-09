-- Corrige idOrdemPagamento nulo em ordem_pagamento_unico (produção) usando valores do backup bkp-0210 (02/10/2026).
-- Só atualiza os 14 ids confirmados que tinham valor não-nulo no backup e continuam nulos em produção.
UPDATE ordem_pagamento_unico AS prod
SET "idOrdemPagamento" = bkp.valor
FROM (VALUES
  (1966, 'STUC_0001'),
  (2205, '534394'),
  (2226, '534051'),
  (2403, '534591'),
  (2491, '534678'),
  (2533, '534720'),
  (2615, '534801'),
  (2623, '534043'),
  (2673, '534856'),
  (2875, '535048'),
  (2951, '535124'),
  (3058, 'STUC_0001'),
  (3267, '535437'),
  (3480, '535655')
) AS bkp(id, valor)
WHERE prod.id = bkp.id
  AND prod."idOrdemPagamento" IS NULL;
