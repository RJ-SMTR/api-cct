import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Versiona as stored procedures do agrupamento de PENDENTES (fluxo ordem_pagamento /
 * consorcio). Ate aqui elas so existiam criadas manualmente no banco, sem controle
 * de versao - o que impedia recriar um ambiente/CI do zero e revisar mudancas.
 *
 * Definicoes capturadas do banco de referencia em 2026-09-08. Guardadores ficam de
 * fora (terao processo proprio).
 *
 * `up` usa CREATE OR REPLACE: em ambientes que ja tem a procedure, alinha a definicao
 * com esta; onde nao existe, cria. **Antes de rodar em producao, conferir que a
 * definicao de la e igual a este arquivo** (ex.: `\sf public.p_agrupar_ordens_estornos_rejeitados`).
 */
export class VersionAgrupamentoPendentesProcedures1786320000000 implements MigrationInterface {
  name = 'VersionAgrupamentoPendentesProcedures1786320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agrupamento efetivamente usado hoje pelo fluxo de pendentes
    // (cron-jobs -> agruparOrdensDeEstornadosRejeitados).
    await queryRunner.query(`
CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_estornos_rejeitados(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer, IN idoperadoras integer[])
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    rec RECORD;
    novoAgrupadoId BIGINT;
BEGIN
    -- Agrupar ordens encontradas na primeira query
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
            da."dataVencimento" BETWEEN datainicial AND datafinal
    AND (
        idOperadoras IS NULL
        OR pu."id" = ANY (idOperadoras)
    )
            AND op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
			-- and opa."ordemPagamentoAgrupadoId" is NULL
            AND oph."motivoStatusRemessa" NOT IN ('AM', '00', 'BD')
            AND oph."statusRemessa" NOT IN ('3', '5')
			AND pu."bloqueado" = FALSE
            AND op."userId" IS NOT NULL
            AND da."valorLancamento" <> '0.00'
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
            1
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
            1
        FROM public."user" u
        WHERE u.id = rec."userId";


        RAISE INFO 'Criado novo agrupamento % para usuário %, total % (ordens: %)',
            novoAgrupadoId, rec."userId", rec.total_valor, rec.ordens_ids;
    END LOOP;

    COMMIT;
END;
$procedure$
    `);

    // Agrupamento de pendentes "legado" - hoje o caminho no service esta comentado,
    // mas a procedure e referenciada por agruparOrdensDePagamentoPendentes.
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
                1
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP PROCEDURE IF EXISTS public.p_agrupar_ordens_pendentes(date, date, date, integer, integer[])`,
    );
    await queryRunner.query(
      `DROP PROCEDURE IF EXISTS public.p_agrupar_ordens_estornos_rejeitados(date, date, date, integer, integer[])`,
    );
  }
}
