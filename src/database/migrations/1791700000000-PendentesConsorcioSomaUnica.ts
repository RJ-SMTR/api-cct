import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pendentes de permissionários: cada agrupamento filho entra uma única vez na soma do pai.
 *
 * Problema: no PASSO 1 de P_AGRUPAR_ORDENS_CONSORCIO_PENDENTES, a CTE `agrupado` usa SELECT DISTINCT sobre
 * (usuário, valorRealEfetivado, dataVencimento, agrupamento). Quando o agrupamento rejeitado tem mais de
 * um histórico rejeitado com detalhe_a próprio (mesmo valor, dataVencimento diferente), o DISTINCT não os junta e o valor do agrupamento é somado duas
 * vezes — o pai sai maior que a soma das filhas (caso observado: William da Silva Passos, R$ 177,78 em vez de R$ 115,51,
 * com a filha 357811 de R$ 62,27 contada em dobro).
 *
 * Correção: DISTINCT ON (agrupamento, usuário), ficando com o detalhe_a mais recente (maior id). Demais regras, filtros
 * e o PASSO 0 ficam como estavam (ProtegePendentesContraDuplicidade1791500000000).
 */
export class PendentesConsorcioSomaUnica1791700000000 implements MigrationInterface {
  name = 'PendentesConsorcioSomaUnica1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(PROCEDURE_CONSORCIO_NOVA);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(PROCEDURE_CONSORCIO_ANTERIOR);
  }
}

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
        -- Uma linha por (agrupamento filho, usuario): se houver mais de um historico rejeitado/detalhe_a, vale so o mais
        -- recente (maior id). Antes o DISTINCT nao juntava detalhes com dataVencimento diferente e somava o valor em dobro.
        SELECT "userId", valor, data_pagamento, opa_id FROM (
        SELECT DISTINCT ON (opa.id, pu.id)
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
        ORDER BY opa.id, pu.id, da.id DESC
        ) falhas

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

/** Definição vigente antes desta migration (ProtegePendentesContraDuplicidade1791500000000). */
const PROCEDURE_CONSORCIO_ANTERIOR = `CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_consorcio_pendentes(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer, IN idsfavorecidos integer[])
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
