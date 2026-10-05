import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * p_agrupar_ordens_consorcio_pendentes (VersionAgrupamentoPendentesProcedures1786320000000)
 * bounded PASSO 0 (never-grouped orders) by datainicial/datafinal and left
 * PASSO 1's real-failure branch unbounded on purpose - a failed attempt is
 * pending regardless of how long ago it happened.
 *
 * Running this for real against production (2026-10-01) surfaced the actual
 * size of that backlog: 55 users, R$111.054,28, failures going back to
 * 2024-06-21 - this pendente mechanism never existed before this PR, so
 * nothing had ever been retried. Decision (Matthew, 2026-10-01): swap which
 * branch the date window applies to, so each run's backlog payout is
 * controllable:
 *
 * - PASSO 0 (never-grouped) now scans the whole table, no date window.
 * - PASSO 1's real-failure branch is now bounded by datainicial/datafinal
 *   on detalhe_a.dataVencimento.
 *
 * Known trade-off, accepted: a failure whose dataVencimento falls outside
 * the window passed to a given run is skipped that run (not lost - it is
 * still correctly classified NaoEfetivado and will be picked up by a later
 * run whose window covers it).
 *
 * Running PASSO 0 unbounded against production also surfaced a separate,
 * pre-existing bug in its own NOT EXISTS guard: it checked whether the user
 * had EVER had anything grouped in their entire history, meant as a crude
 * "don't confuse the in-flight cycle with never-paid" safeguard. For any
 * normal active user (who has months of already-paid history), that guard
 * permanently excludes them from PASSO 0 the moment they have any grouped
 * order at all - a stray never-grouped order from months ago becomes
 * invisible forever, neither PASSO 0 (blocked by this guard) nor PASSO 1
 * (no detalhe_a, since it was never even attempted) can reach it. Found via
 * two real users (Alan da Silva Matheus, R$4.651,20; Jefferson Pinto de
 * Oliveira, R$1.291,20) stuck in exactly this gap.
 *
 * Fix: replace the user-level "ever grouped" check with an order-level
 * recency check - only pick up an order whose own dataCaptura is more than
 * 10 days old, safely outside any normal processing cycle (the normal
 * consórcio flow runs Tuesday/Friday, covering at most ~4 days back) -
 * instead of a permanent per-user exclusion.
 */
export class SwapConsorcioPendenteDateScope1790900000000 implements MigrationInterface {
  name = 'SwapConsorcioPendenteDateScope1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_consorcio_pendentes(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer, IN idsfavorecidos integer[])
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    rec RECORD;
    fresh RECORD;
    novoAgrupadoId BIGINT;
    freshOpaId BIGINT;
    freshOpaIds BIGINT[] := '{}';
BEGIN
    -- PASSO 0: ordem_pagamento que nunca foi agrupada tambem e pendente (era
    -- pago pela primeira vez e nunca entrou em nenhuma remessa). Varre a
    -- tabela inteira, sem corte de data (SwapConsorcioPendenteDateScope1790900000000)
    -- - datainicial/datafinal nao se aplicam mais aqui, so ao PASSO 1.
    --
    -- Corte de 10 dias na propria dataCaptura da ordem - nao no historico do
    -- usuario (ver docstring da migration): so pega ordens capturadas ha
    -- mais de 10 dias, fora de qualquer janela normal de processamento,
    -- pra nao confundir o ciclo em andamento com "nunca pago", sem excluir
    -- permanentemente usuarios que ja tiveram qualquer coisa agrupada antes.
    FOR fresh IN (
        SELECT
            op."userId",
            SUM(op.valor) AS total_valor
        FROM ordem_pagamento op
        INNER JOIN public."user" pu ON pu.id = op."userId"
        WHERE op."ordemPagamentoAgrupadoId" IS NULL
          AND op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
          AND (idsfavorecidos IS NULL OR pu."id" = ANY(idsfavorecidos))
          AND pu."bloqueado" IS NOT TRUE
          AND op."userId" IS NOT NULL
          AND op.valor <> 0
          AND pu."bankAccount" IS NOT NULL
          AND pu."bankAgency" IS NOT NULL
          AND pu."bankCode" IS NOT NULL
          AND pu."bankAccountDigit" IS NOT NULL
          AND date_trunc('day', op."dataCaptura") <= (CURRENT_DATE - INTERVAL '10 days')
        GROUP BY op."userId"
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

        UPDATE public.ordem_pagamento
        SET "ordemPagamentoAgrupadoId" = freshOpaId
        WHERE "userId" = fresh."userId"
          AND "ordemPagamentoAgrupadoId" IS NULL
          AND "nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
          AND date_trunc('day', "dataCaptura") <= (CURRENT_DATE - INTERVAL '10 days');

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

        RAISE INFO 'Consórcio pendente: ordem nunca agrupada -> OPA % criada para usuario %, total %',
            freshOpaId, fresh."userId", fresh.total_valor;
    END LOOP;

    -- PASSO 1: agrupamento pai/filha de sempre. "agrupado" e UNION ALL de
    -- falhas antigas (com detalhe_a) + OPAs frescas do PASSO 0 (sem
    -- detalhe_a, valor vem da propria OPA) - disjuntas por construcao.
    --
    -- Falha real (branch de baixo, com detalhe_a) AGORA tem corte de data em
    -- da."dataVencimento" (SwapConsorcioPendenteDateScope1790900000000) - uma
    -- falha fora da janela passada nesta execucao fica de fora desta vez,
    -- mas continua corretamente classificada como NaoEfetivado e sera pega
    -- por uma proxima execucao cuja janela cubra a data dela. Isso limita
    -- quanto do backlog historico e pago por execucao, em vez de pagar tudo
    -- de uma vez na primeira rodada.
    FOR rec IN (
   WITH
    agrupado AS (
        SELECT DISTINCT
            pu.id AS "userId",
            da."valorRealEfetivado" AS valor,
            da."dataVencimento" AS data_pagamento,
            opa.id AS opa_id
        FROM
            ordem_pagamento op
            INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
            INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
            INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
            INNER JOIN public."user" pu ON pu."id" = op."userId"
        WHERE
    (
        idsfavorecidos IS NULL
        OR pu."id" = ANY (idsfavorecidos)
    )
            AND op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
            AND date_trunc('day', da."dataVencimento") BETWEEN datainicial AND datafinal
            -- motivoStatusRemessa IS NULL entra explicitamente: uma ordem
            -- enviada que nunca recebeu NENHUMA resposta de retorno fica com
            -- motivo NULL (nao um codigo de sucesso), e e tao pendente quanto
            -- uma rejeitada - "NOT IN" sozinho nunca inclui NULL (evalua pra
            -- NULL, nao TRUE). Mesmo bug achado e corrigido pro guardador em
            -- RewriteGuardadorPendenteProcedure1786400000000.
            AND (oph."motivoStatusRemessa" IS NULL OR oph."motivoStatusRemessa" NOT IN ('AM', '00', 'BD'))
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
            ordem_pagamento op
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
        -- Criar novo agrupado com a soma
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

        -- Atualizar todas as ordens do usuário para esse novo agrupado
        UPDATE public.ordem_pagamento_agrupado
        SET "ordemPagamentoAgrupadoId" = novoAgrupadoId
        WHERE id = ANY(rec.ordens_ids);

        -- Inserir histórico do agrupado
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

        RAISE INFO 'Criado novo agrupamento % para usuário %, total % (ordens: %)',
            novoAgrupadoId, rec."userId", rec.total_valor, rec.ordens_ids;
    END LOOP;

    COMMIT;
END;
$procedure$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_consorcio_pendentes(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer, IN idsfavorecidos integer[])
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    rec RECORD;
    fresh RECORD;
    novoAgrupadoId BIGINT;
    freshOpaId BIGINT;
    freshOpaIds BIGINT[] := '{}';
BEGIN
    FOR fresh IN (
        SELECT
            op."userId",
            SUM(op.valor) AS total_valor
        FROM ordem_pagamento op
        INNER JOIN public."user" pu ON pu.id = op."userId"
        WHERE op."ordemPagamentoAgrupadoId" IS NULL
          AND date_trunc('day', op."dataCaptura") BETWEEN datainicial AND datafinal
          AND op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
          AND (idsfavorecidos IS NULL OR pu."id" = ANY(idsfavorecidos))
          AND pu."bloqueado" IS NOT TRUE
          AND op."userId" IS NOT NULL
          AND op.valor <> 0
          AND pu."bankAccount" IS NOT NULL
          AND pu."bankAgency" IS NOT NULL
          AND pu."bankCode" IS NOT NULL
          AND pu."bankAccountDigit" IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM ordem_pagamento op2
              WHERE op2."userId" = op."userId"
                AND op2."ordemPagamentoAgrupadoId" IS NOT NULL
          )
        GROUP BY op."userId"
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

        UPDATE public.ordem_pagamento
        SET "ordemPagamentoAgrupadoId" = freshOpaId
        WHERE "userId" = fresh."userId"
          AND "ordemPagamentoAgrupadoId" IS NULL
          AND date_trunc('day', "dataCaptura") BETWEEN datainicial AND datafinal
          AND "nomeConsorcio" IN ('STPC', 'STPL', 'TEC');

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

        RAISE INFO 'Consórcio pendente: ordem nunca agrupada -> OPA % criada para usuario %, total %',
            freshOpaId, fresh."userId", fresh.total_valor;
    END LOOP;

    FOR rec IN (
   WITH
    agrupado AS (
        SELECT DISTINCT
            pu.id AS "userId",
            da."valorRealEfetivado" AS valor,
            da."dataVencimento" AS data_pagamento,
            opa.id AS opa_id
        FROM
            ordem_pagamento op
            INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
            INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
            INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph."id"
            INNER JOIN public."user" pu ON pu."id" = op."userId"
        WHERE
    (
        idsfavorecidos IS NULL
        OR pu."id" = ANY (idsfavorecidos)
    )
            AND op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
            AND (oph."motivoStatusRemessa" IS NULL OR oph."motivoStatusRemessa" NOT IN ('AM', '00', 'BD'))
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
            ordem_pagamento op
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

        RAISE INFO 'Criado novo agrupamento % para usuário %, total % (ordens: %)',
            novoAgrupadoId, rec."userId", rec.total_valor, rec.ordens_ids;
    END LOOP;

    COMMIT;
END;
$procedure$
    `);
  }
}
