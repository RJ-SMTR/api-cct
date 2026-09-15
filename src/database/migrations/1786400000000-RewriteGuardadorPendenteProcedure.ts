import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guardador pending-payment grouping. Two things a pendente run must catch,
 * neither handled before this procedure: orders that failed a real send
 * attempt (and remain unresolved), and orders that were captured but never
 * grouped into any remittance at all.
 *
 * PASSO 0 groups never-grouped ordem_pagamento_guardador rows into a fresh
 * OPA/history per user (status Criado), guarded by bank-data completeness
 * and by NOT EXISTS so a user's current-cycle order in flight isn't mistaken
 * for "never paid" just because the normal flow hasn't grouped it yet.
 *
 * PASSO 1 is the usual pai/filha grouping, now a UNION ALL of real failures
 * (via detalhe_a, no date cutoff - a failed attempt is pending regardless of
 * how long ago it happened) and the fresh OPAs PASSO 0 just created.
 *
 * `up` uses CREATE OR REPLACE: aligns the definition where the procedure
 * already exists, creates it where it doesn't.
 */
export class RewriteGuardadorPendenteProcedure1786400000000 implements MigrationInterface {
  name = 'RewriteGuardadorPendenteProcedure1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_guardador_pendente(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    rec RECORD;
    fresh RECORD;
    novoAgrupadoId BIGINT;
    freshOpaId BIGINT;
    freshOpaIds BIGINT[] := '{}';
BEGIN
    -- PASSO 0: ordem_pagamento_guardador que nunca foi agrupada tambem e
    -- pendente. Cria 1 OPA + 1 oph (status 0) por usuario, somando o
    -- valorRepasseGuardador das ordens soltas na janela, e linka nelas -
    -- igual o fluxo normal faria - pra virarem filha no PASSO 1.
    FOR fresh IN (
        SELECT
            og."userId",
            SUM(og."valorRepasseGuardador") AS total_valor
        FROM ordem_pagamento_guardador og
        INNER JOIN public."user" pu ON pu.id = og."userId"
        WHERE og."ordemPagamentoAgrupadoId" IS NULL
          AND date_trunc('day', og."dataOrdem") BETWEEN datainicial AND datafinal
          AND pu."bloqueado" IS NOT TRUE
          AND og."valorRepasseGuardador" <> 0
          AND pu."bankAccount" IS NOT NULL
          AND pu."bankAgency" IS NOT NULL
          AND pu."bankCode" IS NOT NULL
          AND pu."bankAccountDigit" IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM ordem_pagamento_guardador og2
              WHERE og2."userId" = og."userId"
                AND og2."ordemPagamentoAgrupadoId" IS NOT NULL
          )
        GROUP BY og."userId"
    )
    LOOP
        INSERT INTO public.ordem_pagamento_agrupado
            (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "pagadorId")
        VALUES
            (nextval('ordem_pagamento_agrupado_id_seq'),
             datapagamento,
             fresh.total_valor,
             current_timestamp,
             current_timestamp,
             pagadorid)
        RETURNING id INTO freshOpaId;

        UPDATE public.ordem_pagamento_guardador
        SET "ordemPagamentoAgrupadoId" = freshOpaId
        WHERE "userId" = fresh."userId"
          AND "ordemPagamentoAgrupadoId" IS NULL
          AND date_trunc('day', "dataOrdem") BETWEEN datainicial AND datafinal;

        INSERT INTO public.ordem_pagamento_agrupado_historico (
            id, "ordemPagamentoAgrupadoId", "dataReferencia",
            "userBankAccountDigit", "userBankAccount", "userBankAgency",
            "userBankCode", "statusRemessa"
        )
        SELECT
            nextval('ordem_pagamento_agrupado_historico_id_seq'),
            freshOpaId,
            datapagamento,
            u."bankAccountDigit",
            u."bankAccount",
            u."bankAgency",
            u."bankCode",
            0
        FROM public."user" u
        WHERE u.id = fresh."userId";

        freshOpaIds := array_append(freshOpaIds, freshOpaId);

        RAISE INFO 'Guardador pendente: ordem nunca agrupada -> OPA % criada para usuario %, total %',
            freshOpaId, fresh."userId", fresh.total_valor;
    END LOOP;

    -- PASSO 1: agrupamento pai/filha de sempre. "agrupado" agora e UNION ALL de
    -- falhas antigas (com detalhe_a) + OPAs frescas do PASSO 0 (sem detalhe_a,
    -- valor vem da propria OPA) - disjuntas por construcao.
    --
    -- Falha real (branch de baixo, com detalhe_a) NAO tem corte de data - uma
    -- falha real e pendente independente de ha quanto tempo aconteceu. O
    -- corte de ciclo em curso so faz sentido pro PASSO 0 (nunca pago), que e
    -- o unico lugar aqui que ainda usa datainicial/datafinal.
    FOR rec IN (
   WITH
    agrupado AS (
        SELECT DISTINCT
            pu.id AS "userId",
            da."valorRealEfetivado" AS valor,
            da."dataVencimento" AS data_pagamento,
            opa.id AS opa_id
        FROM
            ordem_pagamento_guardador op
            INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
            INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
            INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
            INNER JOIN public."user" pu ON pu."id" = op."userId"
        WHERE
            oph."motivoStatusRemessa" NOT IN ('AM', '00', 'BD')
            AND oph."statusRemessa" NOT IN ('3', '5')
            AND pu."bloqueado" IS NOT TRUE
            AND op."userId" IS NOT NULL
            AND da."valorLancamento" <> '0.00'

        UNION ALL

        SELECT DISTINCT
            pu.id AS "userId",
            opa."valorTotal" AS valor,
            opa."dataPagamento" AS data_pagamento,
            opa.id AS opa_id
        FROM
            ordem_pagamento_guardador op
            INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
            INNER JOIN public."user" pu ON pu."id" = op."userId"
        WHERE
            opa.id = ANY(freshOpaIds)
    )
SELECT
    t."userId",
    SUM(t.valor) AS total_valor,
    MIN(t.data_pagamento) AS primeira_data,
    MAX(t.data_pagamento) AS ultima_data,
    array_agg(DISTINCT t.opa_id) AS ordens_ids
FROM agrupado t
GROUP BY
    t."userId"
    )
    LOOP
        INSERT INTO public.ordem_pagamento_agrupado
            (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "pagadorId")
        VALUES
            (nextval('ordem_pagamento_agrupado_id_seq'),
             datapagamento,
             rec.total_valor,
             current_timestamp,
             current_timestamp,
             pagadorid)
        RETURNING id INTO novoAgrupadoId;

        UPDATE public.ordem_pagamento_agrupado
        SET "ordemPagamentoAgrupadoId" = novoAgrupadoId
        WHERE id = ANY(rec.ordens_ids);

        INSERT INTO public.ordem_pagamento_agrupado_historico (
            id, "ordemPagamentoAgrupadoId", "dataReferencia",
            "userBankAccountDigit", "userBankAccount", "userBankAgency",
            "userBankCode", "statusRemessa"
        )
        SELECT
            nextval('ordem_pagamento_agrupado_historico_id_seq'),
            novoAgrupadoId,
            datapagamento,
            u."bankAccountDigit",
            u."bankAccount",
            u."bankAgency",
            u."bankCode",
            0
        FROM public."user" u
        WHERE u.id = rec."userId";

        INSERT INTO public.ordem_pagamento_agrupado_historico (
            id, "ordemPagamentoAgrupadoId", "dataReferencia",
            "userBankAccountDigit", "userBankAccount", "userBankAgency",
            "userBankCode", "statusRemessa"
        )
        SELECT
            nextval('ordem_pagamento_agrupado_historico_id_seq'),
            unnest(rec.ordens_ids),
            datapagamento,
            u."bankAccountDigit",
            u."bankAccount",
            u."bankAgency",
            u."bankCode",
            0
        FROM public."user" u
        WHERE u.id = rec."userId";

        RAISE INFO 'Guardador pendente: novo agrupamento % para usuario %, total % (ordens: %)',
            novoAgrupadoId, rec."userId", rec.total_valor, rec.ordens_ids;
    END LOOP;

    COMMIT;
END;
$procedure$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP PROCEDURE IF EXISTS public.p_agrupar_ordens_guardador_pendente(date, date, date, integer)`,
    );
  }
}
