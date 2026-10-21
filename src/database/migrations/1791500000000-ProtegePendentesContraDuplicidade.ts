import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pendentes (permissionários e guardadores): só vai para o banco o que NUNCA foi pago.
 *
 * Problema: as procedures P_AGRUPAR_ORDENS_CONSORCIO_PENDENTES e P_AGRUPAR_ORDENS_GUARDADOR_PENDENTE tratavam como
 * pendência qualquer pagamento sem retorno de sucesso, inclusive o que acabou de ser enviado (statusRemessa 0/1/2, motivo
 * vazio) e o do dia. Resultado em produção: o pagamento do dia e pagamentos já efetuados voltavam a ser remetidos
 * (ex.: guardadores de 21/10/2026 e permissionários pagos duas/três vezes em 03/09, 10/09 e 08/10).
 *
 * Regras novas (nas duas procedures):
 *  - Pendência = SOMENTE o que o banco rejeitou: histórico com statusRemessa 4 (NaoEfetivado) e motivo de erro.
 *    "Enviado sem retorno" deixa de ser pendência (pode estar em andamento ou ter sido pago).
 *  - Fica de fora o agrupamento que já tenha outro histórico pago (3/5) ou cujo PAI exista e esteja criado/em andamento/pago (0/1/2/3/5).
 *    Isso também torna a preparação idempotente: pais já preparados (ainda não enviados) não são agrupados de novo.
 *  - Ordens do dia corrente (horário de Brasília) nunca entram.
 *  - Ordem com equivalente (mesmo favorecido, dia e valor; nos permissionários também o id da ordem) já paga ou em
 *    pagamento em outro agrupamento deixa o agrupamento inteiro de fora (evita pagar em dobro); revisão manual.
 *  - PASSO 0 (ordens nunca agrupadas): mesmas exclusões de ordem do dia e de ordem equivalente já paga/em pagamento.
 *
 * Efeito colateral aceito: pagamentos "enviados sem retorno" antigos (ex.: 18 permissionários de jan/fev de 2025)
 * deixam de ser reenviados automaticamente; precisam de conferência manual do retorno do banco.
 */
export class ProtegePendentesContraDuplicidade1791500000000 implements MigrationInterface {
  name = 'ProtegePendentesContraDuplicidade1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE OR REPLACE FUNCTION public.fn_ordem_guardador_ja_paga_ou_em_andamento(p_ordem_id integer) RETURNS boolean
LANGUAGE sql STABLE AS $f$
  SELECT EXISTS (
    SELECT 1
      FROM ordem_pagamento_guardador o1
      JOIN ordem_pagamento_guardador o2 ON o2."userId" = o1."userId" AND o2."dataOrdem" = o1."dataOrdem"
                                       AND o2."valorRepasseGuardador" = o1."valorRepasseGuardador" AND o2.id <> o1.id
      JOIN ordem_pagamento_agrupado a2 ON a2.id = o2."ordemPagamentoAgrupadoId"
      JOIN ordem_pagamento_agrupado_historico h2 ON h2."ordemPagamentoAgrupadoId" IN (a2.id, a2."ordemPagamentoAgrupadoId")
      JOIN detalhe_a d2 ON d2."ordemPagamentoAgrupadoHistoricoId" = h2.id
     WHERE o1.id = p_ordem_id
       AND h2."statusRemessa" IN (1, 2, 3, 5)
  )
$f$;`);
    await queryRunner.query(`CREATE OR REPLACE FUNCTION public.fn_ordem_pagamento_ja_paga_ou_em_andamento(p_ordem_id integer) RETURNS boolean
LANGUAGE sql STABLE AS $f$
  SELECT EXISTS (
    SELECT 1
      FROM ordem_pagamento o1
      JOIN ordem_pagamento o2 ON o2."userId" = o1."userId" AND o2."dataOrdem" = o1."dataOrdem" AND o2.valor = o1.valor
                             AND COALESCE(o2."idOrdemPagamento", '') = COALESCE(o1."idOrdemPagamento", '') AND o2.id <> o1.id
      JOIN ordem_pagamento_agrupado a2 ON a2.id = o2."ordemPagamentoAgrupadoId"
      JOIN ordem_pagamento_agrupado_historico h2 ON h2."ordemPagamentoAgrupadoId" IN (a2.id, a2."ordemPagamentoAgrupadoId")
      JOIN detalhe_a d2 ON d2."ordemPagamentoAgrupadoHistoricoId" = h2.id
     WHERE o1.id = p_ordem_id
       AND h2."statusRemessa" IN (1, 2, 3, 5)
  )
$f$;`);
    await queryRunner.query(PROCEDURE_GUARDADOR_NOVA);
    await queryRunner.query(PROCEDURE_CONSORCIO_NOVA);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(PROCEDURE_GUARDADOR_ANTERIOR);
    await queryRunner.query(PROCEDURE_CONSORCIO_ANTERIOR);
    await queryRunner.query('DROP FUNCTION IF EXISTS public.fn_ordem_guardador_ja_paga_ou_em_andamento(integer)');
    await queryRunner.query('DROP FUNCTION IF EXISTS public.fn_ordem_pagamento_ja_paga_ou_em_andamento(integer)');
  }
}

const PROCEDURE_GUARDADOR_NOVA = `CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_guardador_pendente(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    rec RECORD;
    fresh RECORD;
    novoAgrupadoId BIGINT;
    freshOpaId BIGINT;
    freshOpaIds BIGINT[] := '{}';
    -- "hoje" no horário de Brasília: ordens do dia corrente nunca entram em pendência (ainda estão no ciclo normal).
    hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
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
          -- Só ordem de ontem para trás, e que NÃO tenha ordem equivalente já paga ou em pagamento (evita pagar em dobro).
          AND date_trunc('day', og."dataOrdem") < hoje
          AND NOT public.fn_ordem_guardador_ja_paga_ou_em_andamento(og.id)
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
          AND date_trunc('day', "dataOrdem") BETWEEN datainicial AND datafinal
          AND date_trunc('day', "dataOrdem") < hoje
          AND NOT public.fn_ordem_guardador_ja_paga_ou_em_andamento(id);

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
    --
    -- SOMENTE o que o banco REJEITOU (statusRemessa 4 = NaoEfetivado, com motivo de erro) entra em pendência.
    -- Pagamento enviado sem retorno (status 0/1/2, motivo vazio) NÃO é pendência: pode estar em andamento ou ter sido
    -- pago (era assim que o pagamento do dia e os já pagos voltavam a ser enviados em dobro).
    -- Além disso, ficam de fora (nada é enviado ao banco):
    --  * agrupamento que já tenha outro histórico pago (3/5) ou cujo PAI exista e esteja criado/em andamento/pago (0/1/2/3/5; 0 = pai ja criado e ainda nao enviado);
    --  * agrupamento com alguma ordem de hoje;
    --  * agrupamento com alguma ordem equivalente (mesmo guardador, dia e valor) já paga ou em pagamento.
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
            oph."statusRemessa" = 4
            AND oph."motivoStatusRemessa" IS NOT NULL
            AND oph."motivoStatusRemessa" NOT IN ('AM', '00', 'BD')
            AND pu."bloqueado" IS NOT TRUE
            AND op."userId" IS NOT NULL
            AND da."valorLancamento" <> '0.00'
            AND NOT EXISTS (
                SELECT 1 FROM ordem_pagamento_agrupado_historico hp
                WHERE (hp."ordemPagamentoAgrupadoId" = opa.id AND hp."statusRemessa" IN (1, 2, 3, 5))
                   OR (hp."ordemPagamentoAgrupadoId" = opa."ordemPagamentoAgrupadoId" AND hp."statusRemessa" IN (0, 1, 2, 3, 5))
            )
            AND NOT EXISTS (
                SELECT 1 FROM ordem_pagamento_guardador x
                WHERE x."ordemPagamentoAgrupadoId" = opa.id
                  AND (date_trunc('day', x."dataOrdem") >= hoje
                       OR public.fn_ordem_guardador_ja_paga_ou_em_andamento(x.id))
            )

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
$procedure$`;

const PROCEDURE_CONSORCIO_NOVA = `CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_consorcio_pendentes(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer, IN idsfavorecidos integer[])
 LANGUAGE plpgsql
AS $procedure$
DECLARE
    rec RECORD;
    fresh RECORD;
    novoAgrupadoId BIGINT;
    freshOpaId BIGINT;
    freshOpaIds BIGINT[] := '{}';
    -- "hoje" no horário de Brasília: ordens do dia corrente nunca entram em pendência.
    hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
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
          -- Nunca ordem de hoje nem ordem equivalente já paga ou em pagamento (evita pagar em dobro).
          AND date_trunc('day', op."dataCaptura") < hoje
          AND NOT public.fn_ordem_pagamento_ja_paga_ou_em_andamento(op.id)
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
          AND date_trunc('day', "dataCaptura") <= (CURRENT_DATE - INTERVAL '10 days')
          AND date_trunc('day', "dataCaptura") < hoje
          AND NOT public.fn_ordem_pagamento_ja_paga_ou_em_andamento(id);

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
            -- SOMENTE o que o banco REJEITOU (statusRemessa 4 = NaoEfetivado, com motivo de erro) entra em pendência.
            -- Pagamento enviado sem retorno (status 0/1/2, motivo vazio) NAO e pendência: pode estar em andamento ou ja
            -- ter sido pago. Ficam de fora: agrupamento com outro historico pago (3/5) ou cujo PAI exista e esteja criado/em
            -- andamento/pago (0/1/2/3/5; 0 = pai ja criado e ainda nao enviado); com ordem de hoje; ou com ordem equivalente ja paga ou em pagamento.
            AND oph."statusRemessa" = 4
            AND oph."motivoStatusRemessa" IS NOT NULL
            AND oph."motivoStatusRemessa" NOT IN ('AM', '00', 'BD')
            AND pu."bloqueado" IS NOT TRUE
            AND op."userId" IS NOT NULL
            AND da."valorLancamento" <> '0.00'
            AND NOT EXISTS (
                SELECT 1 FROM ordem_pagamento_agrupado_historico hp
                WHERE (hp."ordemPagamentoAgrupadoId" = opa.id AND hp."statusRemessa" IN (1, 2, 3, 5))
                   OR (hp."ordemPagamentoAgrupadoId" = opa."ordemPagamentoAgrupadoId" AND hp."statusRemessa" IN (0, 1, 2, 3, 5))
            )
            AND NOT EXISTS (
                SELECT 1 FROM ordem_pagamento x
                WHERE x."ordemPagamentoAgrupadoId" = opa.id
                  AND (date_trunc('day', x."dataCaptura") >= hoje
                       OR public.fn_ordem_pagamento_ja_paga_ou_em_andamento(x.id))
            )

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
$procedure$`;

/** Definições vigentes em produção antes desta migration (VersionAgrupamentoPendentesProcedures / SwapConsorcioPendenteDateScope). */
const PROCEDURE_GUARDADOR_ANTERIOR = `CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_guardador_pendente(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer)
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
    --
    -- motivoStatusRemessa IS NULL entra explicitamente: uma ordem enviada
    -- que nunca recebeu NENHUMA resposta de retorno fica com motivo NULL
    -- (nao um codigo de sucesso), e e tao pendente quanto uma rejeitada -
    -- "NOT IN" sozinho nunca inclui NULL (evalua pra NULL, nao TRUE).
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
            (oph."motivoStatusRemessa" IS NULL OR oph."motivoStatusRemessa" NOT IN ('AM', '00', 'BD'))
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
$procedure$`;

const PROCEDURE_CONSORCIO_ANTERIOR = `CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_consorcio_pendentes(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer, IN idsfavorecidos integer[])
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
$procedure$`;
