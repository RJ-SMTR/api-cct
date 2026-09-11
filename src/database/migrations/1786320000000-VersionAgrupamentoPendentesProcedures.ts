import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Final pending-payment procedures for consortium and guardador beneficiaries.
 * Failed attempts remain eligible regardless of date; never-grouped orders use
 * the requested window and bank-data checks. New histories start as Created.
 * The legacy consortium procedure remains available for existing callers.
 * Rollback removes these definitions; it does not restore preexisting routines.
 */
export class VersionAgrupamentoPendentesProcedures1786320000000 implements MigrationInterface {
  name = 'VersionAgrupamentoPendentesProcedures1786320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Active consortium pending-payment grouping.
    await queryRunner.query(`
CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_estornos_rejeitados(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer, IN idoperadoras integer[])
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
    -- pago pela primeira vez e nunca entrou em nenhuma remessa). Cria 1 OPA +
    -- 1 oph (status 0) por usuario, somando o valor das ordens soltas na
    -- janela, e linka nelas - igual o fluxo normal (p_agrupar_ordens) faria -
    -- pra virarem filha no PASSO 1.
    FOR fresh IN (
        SELECT
            op."userId",
            SUM(op.valor) AS total_valor
        FROM ordem_pagamento op
        INNER JOIN public."user" pu ON pu.id = op."userId"
        WHERE op."ordemPagamentoAgrupadoId" IS NULL
          AND date_trunc('day', op."dataCaptura") BETWEEN datainicial AND datafinal
          AND op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
          AND (idOperadoras IS NULL OR pu."id" = ANY(idOperadoras))
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

        RAISE INFO 'Estornos/rejeitados: ordem nunca agrupada -> OPA % criada para usuario %, total %',
            freshOpaId, fresh."userId", fresh.total_valor;
    END LOOP;

    -- PASSO 1: agrupamento pai/filha de sempre. "agrupado" agora e UNION ALL
    -- de falhas antigas (com detalhe_a, como antes) + OPAs frescas do PASSO 0
    -- (sem detalhe_a, valor vem da propria OPA) - disjuntas por construcao.
    --
    -- Falha real (branch de baixo, com detalhe_a) NAO tem corte de data - nem
    -- datainicial nem datafinal. Motivo: falha real deve ser paga sempre que
    -- rodar o pendentes, nao importa ha quanto tempo aconteceu (achado real
    -- em 11/09/2026: usuario com falhas nao resolvidas desde janeiro/2026 -
    -- limitar a janela deixava R$16k+ de historico antigo de fora, so pegando
    -- o mes corrente). O corte de ciclo em curso (Terca-Quinta/Sexta-Segunda)
    -- so faz sentido pro PASSO 0 (nunca pago) - so ali "datainicial/datafinal"
    -- ainda sao usados, pra decidir SE algo e pendente. Falha real (status
    -- 4, motivo != codigo de sucesso) ja e pendente por definicao, o "quando"
    -- nao importa.
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
        idOperadoras IS NULL
        OR pu."id" = ANY (idOperadoras)
    )
            AND op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
			-- and opa."ordemPagamentoAgrupadoId" is NULL
            AND oph."motivoStatusRemessa" NOT IN ('AM', '00', 'BD')
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
            unnest(rec.ordens_ids),   -- cada opa_id antigo
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

    // Preserve the legacy procedure for existing callers.
    await queryRunner.query(`
CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_pendentes(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer, IN idoperadoras integer[])
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    ordem RECORD;
    ordemPagamentoAgrupadoId BIGINT;
BEGIN
    -- Loop para percorrer cada ordem de pagamento com userId nao nulo
    FOR ordem IN (

		-- Query 2: Pendentes de 2025
		SELECT DISTINCT
			op.id,
		  DATE(op."dataOrdem") AS dataPagamento,
	      op."nomeOperadora" as nomes,
		  op."valor" AS valor,
		  pu."permitCode" AS "permitCode",
		  pu.id AS "userId",
		  NULL::bigint AS "itemTransacaoAgrupadoId",
  		  'operadora' AS tipo_registro
		FROM ordem_pagamento op
		INNER JOIN public."user" pu ON pu.id = op."userId"
		WHERE
		    op."dataOrdem" BETWEEN datainicial  AND datafinal
		    AND op."ordemPagamentoAgrupadoId" IS NULL
			and pu."bankAccount" IS NOT NULL
			AND pu."bloqueado" = FALSE
			AND (idOperadoras IS NULL OR pu.id = ANY(idOperadoras))
			AND op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')	)

    LOOP
        -- Skip if user doesn't have banking data
        IF EXISTS (
            SELECT 1
            FROM "user" u
            WHERE (u."bankAccount" IS NULL
               OR u."bankAgency" IS NULL
               OR u."bankCode" IS NULL
               OR u."bankAccountDigit" IS NULL)
              AND u.id = ordem."userId"
        ) THEN
            RAISE INFO 'Usuário % não possui dados bancários para a ordem %', ordem."userId", ordem."itemTransacaoAgrupadoId";
            CONTINUE;
        END IF;


        SELECT op."ordemPagamentoAgrupadoId"
        INTO ordemPagamentoAgrupadoId
        FROM public.ordem_pagamento op
        WHERE op.id = ordem.id
        LIMIT 1;

        IF ordemPagamentoAgrupadoId IS NULL THEN
            -- Create new grouped payment order
            INSERT INTO public.ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "pagadorId")
            VALUES (nextval('ordem_pagamento_agrupado_id_seq'), datapagamento, ordem.valor, current_timestamp, current_timestamp, pagadorid)
            RETURNING id INTO ordemPagamentoAgrupadoId;

            -- Update existing ordem_pagamento records for this user and item
            UPDATE public.ordem_pagamento
            SET "ordemPagamentoAgrupadoId" = ordemPagamentoAgrupadoId
            WHERE "userId" = ordem."userId"
			AND "dataOrdem" between datainicial and datafinal
			and "ordemPagamentoAgrupadoId" IS NULL;

            -- Insert history record
            INSERT INTO public.ordem_pagamento_agrupado_historico (
                id, "ordemPagamentoAgrupadoId", "dataReferencia",
                "userBankAccountDigit", "userBankAccount", "userBankAgency",
                "userBankCode", "statusRemessa"
            )
            SELECT
                nextval('ordem_pagamento_agrupado_historico_id_seq'),
                ordemPagamentoAgrupadoId,
                datapagamento,
                u."bankAccountDigit",
                u."bankAccount",
                u."bankAgency",
                u."bankCode",
                0
            FROM public."user" u
            WHERE u.id = ordem."userId";

            RAISE INFO 'Criado novo agrupamento % para usuário % com valor %', ordemPagamentoAgrupadoId, ordem."userId", ordem.valor;

        ELSE


            -- Update existing grouped payment order
            UPDATE public.ordem_pagamento_agrupado
            SET "valorTotal" = "valorTotal" + ordem.valor,
                "updatedAt" = current_timestamp
            WHERE id = ordemPagamentoAgrupadoId;

            -- Update ordem_pagamento records


            RAISE INFO 'Adicionado valor % ao agrupamento existente % para usuário %', ordem.valor, ordemPagamentoAgrupadoId, ordem."userId";
        END IF;

    END LOOP;

    COMMIT;
END
$procedure$
    `);
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
    -- Falha real (branch de baixo, com detalhe_a) NAO tem corte de data - ver
    -- comentario equivalente em p_agrupar_ordens_estornos_rejeitados (mesmo
    -- fix, mesmo motivo: falha real e sempre pendente, independente de ha
    -- quanto tempo aconteceu. O corte de ciclo em curso so faz sentido pro
    -- PASSO 0, que ainda usa datainicial/datafinal).
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
    await queryRunner.query(
      `DROP PROCEDURE IF EXISTS public.p_agrupar_ordens_pendentes(date, date, date, integer, integer[])`,
    );
    await queryRunner.query(
      `DROP PROCEDURE IF EXISTS public.p_agrupar_ordens_estornos_rejeitados(date, date, date, integer, integer[])`,
    );
  }
}
