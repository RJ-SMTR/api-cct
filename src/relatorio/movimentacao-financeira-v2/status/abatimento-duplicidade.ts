import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { PERMIT_CODE_MAX_GUARDADOR } from '../../../pagamento_indevido/service/pagamentos-indevidos-guardadores.service';

// "Abatimento por duplicidade" (Guardador): the same rule the Agentes screen applies (app-cct agentesService
// markDuplicateOffsetPayments over PagamentosIndevidosGuardadoresService.porUsuario), moved into SQL so the
// reports filter, paginate and total it like any other status.
//
// A payment line (detalhe_a) is an abatimento when:
// - its guardador has a row in pagamento_indevido (matched by name, permitCode up to 4 characters, as porUsuario);
// - the value sent to the bank (valorLancamento) is lower than what the guardador was owed in that grouping: the
//   sum of the guardador's orders in the grouping or in its PAI (pendencia), the "devido" of porUsuario;
// - it was paid (statusRemessa 3 or 5), or the abatimento zeroed it and the bank rejected it (statusRemessa 4 with
//   valorLancamento 0: nothing left to pay, so it is not a Pendencia de Pagamento).
//
// Motivo: "Valor pago em duplicidade em MM/AAAA", with the months of the duplicate payments (from the second time
// the same order, same day and value, was paid on), as duplicidadesDeOrdens/buildDuplicateOffsetReason do.
export const ABATIMENTO_DUPLICIDADE_MOTIVO_BASE = 'Valor pago em duplicidade';

export const ABATIMENTO_DUPLICIDADE_CTES = `
      abatimento_usuarios AS MATERIALIZED (
        SELECT DISTINCT u.id AS user_id
        FROM pagamento_indevido pi
        INNER JOIN LATERAL (
          SELECT id, "permitCode" FROM public."user"
           WHERE upper(trim("fullName")) = upper(trim(pi."nomeFavorecido"))
           ORDER BY id LIMIT 1
        ) u ON true
        WHERE length(u."permitCode") <= ${PERMIT_CODE_MAX_GUARDADOR}
      ),
      abatimento_ordens AS MATERIALIZED (
        SELECT g."userId" AS user_id, g."ordemPagamentoAgrupadoId" AS agr, a."ordemPagamentoAgrupadoId" AS pai,
               g."valorRepasseGuardador" AS valor, g."dataOrdem"::date AS dia
        FROM abatimento_usuarios au
        INNER JOIN ordem_pagamento_guardador g ON g."userId" = au.user_id
        INNER JOIN ordem_pagamento_agrupado a ON a.id = g."ordemPagamentoAgrupadoId"
      ),
      abatimento_meses AS MATERIALIZED (
        -- Each order (day + value) with every date it was paid; the first is the due payment, the next ones are
        -- the duplicates. Status 5 with a bank occurrence other than 00/AM/BD was not paid by the bank.
        SELECT user_id, ARRAY_AGG(DISTINCT date_trunc('month', data_pagamento) ORDER BY date_trunc('month', data_pagamento)) AS meses
        FROM (
          SELECT user_id, data_pagamento,
                 ROW_NUMBER() OVER (PARTITION BY user_id, dia, valor ORDER BY data_pagamento) AS vez
          FROM (
            SELECT DISTINCT o.user_id, o.dia, ROUND(o.valor::numeric, 2) AS valor, da_dup."dataVencimento"::date AS data_pagamento
            FROM abatimento_ordens o
            INNER JOIN ordem_pagamento_agrupado_historico h_dup ON h_dup."ordemPagamentoAgrupadoId" IN (o.agr, o.pai)
            INNER JOIN detalhe_a da_dup ON da_dup."ordemPagamentoAgrupadoHistoricoId" = h_dup.id
            WHERE h_dup."statusRemessa" IN (3, 5)
              AND NOT (h_dup."statusRemessa" = 5 AND h_dup."motivoStatusRemessa" IS NOT NULL AND h_dup."motivoStatusRemessa" NOT IN ('00', 'AM', 'BD'))
          ) pagamentos
        ) vezes
        WHERE vez > 1
        GROUP BY user_id
      ),
      abatimento_devido AS MATERIALIZED (
        -- What the guardador was owed in each grouping a payment can be sent from: the grouping of his orders and
        -- its PAI (pendencia). An order counts for both, so the sum per grouping is computed once here.
        SELECT o.user_id, v.alvo_id, SUM(o.valor) AS devido
        FROM abatimento_ordens o
        CROSS JOIN LATERAL (VALUES (o.agr), (o.pai)) v(alvo_id)
        WHERE v.alvo_id IS NOT NULL
        GROUP BY o.user_id, v.alvo_id
      ),
      abatimento_lancamentos AS MATERIALIZED (
        SELECT DISTINCT ON (da_ab.id)
          da_ab.id AS "detalheAId",
          d.alvo_id AS "agrupadoId",
          '${ABATIMENTO_DUPLICIDADE_MOTIVO_BASE}' || CASE
            WHEN m.meses IS NULL THEN ''
            WHEN cardinality(m.meses) = 1 THEN ' em ' || to_char(m.meses[1], 'MM/YYYY')
            ELSE ' em ' || array_to_string(ARRAY(SELECT to_char(mes, 'MM/YYYY') FROM unnest(m.meses[1:cardinality(m.meses) - 1]) mes ORDER BY mes), ', ')
              || ' e ' || to_char(m.meses[cardinality(m.meses)], 'MM/YYYY')
          END AS motivo
        FROM abatimento_devido d
        INNER JOIN ordem_pagamento_agrupado_historico oph_ab ON oph_ab."ordemPagamentoAgrupadoId" = d.alvo_id
        INNER JOIN detalhe_a da_ab ON da_ab."ordemPagamentoAgrupadoHistoricoId" = oph_ab.id
        LEFT JOIN abatimento_meses m ON m.user_id = d.user_id
        WHERE da_ab."valorLancamento" < d.devido
          AND (oph_ab."statusRemessa" IN (3, 5) OR (oph_ab."statusRemessa" = 4 AND da_ab."valorLancamento" = 0))
        ORDER BY da_ab.id
      ),`;

// Joins the abatimento of the payment line "daAlias" (alias "ab"; ab."detalheAId" is NULL when it is not one).
export const abatimentoDuplicidadeJoin = (daAlias: string) => `LEFT JOIN abatimento_lancamentos ab ON ab."detalheAId" = ${daAlias}.id`;

// Pendencia (child grouping paid through its PAI): the discount is in the PAI's payment line, so the child row is
// an abatimento when its own line is one or when its PAI ("paiIdSql") has a line with abatimento.
export const abatimentoDuplicidadeJoinComPai = (daAlias: string | null, paiIdSql: string) => `LEFT JOIN LATERAL (
          SELECT ab0."detalheAId", ab0.motivo FROM abatimento_lancamentos ab0
           WHERE ${daAlias ? `ab0."detalheAId" = ${daAlias}.id OR ` : ''}ab0."agrupadoId" = ${paiIdSql}
           ORDER BY ab0."detalheAId" LIMIT 1
        ) ab ON true`;

// Status of a payment line that may be an abatimento: the abatimento wins over Pago/Pendencia Paga/Rejeitado.
export const statusComAbatimentoDuplicidade = (statusSql: string) =>
  `CASE WHEN ab."detalheAId" IS NOT NULL THEN '${StatusPagamento.ABATIMENTO_DUPLICIDADE}' ELSE ${statusSql} END`;

// The payment line "daAlias" is not an abatimento (used to keep it out of the Rejeitado sources).
export const naoEhAbatimentoDuplicidade = (daAlias: string) =>
  `NOT EXISTS (SELECT 1 FROM abatimento_lancamentos ab_fora WHERE ab_fora."detalheAId" = ${daAlias}.id)`;
