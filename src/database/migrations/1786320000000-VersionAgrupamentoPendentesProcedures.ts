import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Versiona as stored procedures do agrupamento de PENDENTES (fluxo ordem_pagamento /
 * consorcio). Ate aqui elas so existiam criadas manualmente no banco, sem controle
 * de versao - o que impedia recriar um ambiente/CI do zero e revisar mudancas.
 *
 * Definicoes capturadas do banco de referencia em 2026-09-08. Guardadores ficam de
 * fora (terao processo proprio).
 *
 * Ajuste: o historico do agrupamento e criado com statusRemessa = 0 (Criado),
 * nao 1, tanto em p_agrupar_ordens_estornos_rejeitados quanto em
 * p_agrupar_ordens_pendentes. p_agrupar_ordens / p_agrupar_ordens_guardador ja
 * usavam 0, e findAllPendente / findAllCustom filtram statusRemessa = 0 - o 1
 * impedia o prepararRemessa de encontrar a ordem pai.
 * (p_agrupar_ordens_pendentes hoje esta sem caller - o ajuste e por consistencia.)
 *
 * `up` usa CREATE OR REPLACE: em ambientes que ja tem a procedure, alinha a definicao
 * com esta; onde nao existe, cria. **Antes de rodar em producao, conferir que a
 * definicao de la e igual a este arquivo** (ex.: `\sf public.p_agrupar_ordens_estornos_rejeitados`).
 *
 * Fix 2026-09-11 (mesmos 2 bugs achados e corrigidos no guardador - ver
 * 1786400000000 - confirmados com dado real tambem pro consorcio):
 *
 *  - "pu.bloqueado = FALSE" excluia silenciosamente usuario com bloqueado NULL
 *    (NULL = FALSE avalia NULL em SQL, nao TRUE). No consorcio o impacto e
 *    menor que no guardador (~1% dos usuarios), mas real: 3 dos 10 candidatos
 *    reais a pendente na janela 01/07-08/09 tinham bloqueado NULL. Trocado
 *    para "bloqueado IS NOT TRUE".
 *
 *  - "pendente" so pegava ordem_pagamento que ja tinha sido agrupada e
 *    falhado - ordem NUNCA agrupada (userId nunca recebeu nada) ficava de
 *    fora. Achado real: 75 ordem_pagamento nunca agrupadas, 22 usuarios,
 *    R$ 418.705,44 na mesma janela. PASSO 0 novo: agrupa ordem_pagamento
 *    solta (ordemPagamentoAgrupadoId IS NULL, mesma janela de dataCaptura e
 *    filtro de consorcio/idOperadoras que o fluxo normal usa) numa OPA nova
 *    por usuario, com o mesmo cuidado do guardador - checa dado bancario
 *    completo, e so entra quem NUNCA teve nenhuma ordem agrupada antes
 *    (NOT EXISTS), pra nao confundir "nunca pago" com "ainda nao processado
 *    pelo ciclo normal desta semana". A existente p_agrupar_ordens_pendentes
 *    (sem caller) fazia algo parecido mas sem essa estrutura pai/filha - nao
 *    reaproveitada, so serviu de referencia.
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
