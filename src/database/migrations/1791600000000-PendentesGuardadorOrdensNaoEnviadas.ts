import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pendentes de guardadores: passa a considerar tambem o que NUNCA foi para o banco.
 *
 * Problema (22/10/2026): a procedure P_AGRUPAR_ORDENS_GUARDADOR_PENDENTE so reconhecia (1) agrupamentos rejeitados pelo banco
 * (status 4) e (2) ordens soltas de quem nunca teve nenhum agrupamento. Ficavam parados, sem nunca serem pagos:
 *  - agrupamentos criados que nunca entraram em remessa (so historico "Criado", sem detalhe_a), ex.: SARAH HERCULANO DE SOUZA
 *    (ordem de 29/09/2026, R$ 190,40), VALDI CACHO e JORGE LUIZ DE ALMEIDA MARTINS;
 *  - ordens soltas (sem agrupamento) de guardadores que ja tinham outro agrupamento (a clausula do passo 0 as excluia).
 *
 * Mudancas (mesmas travas contra pagar em dobro da migration ProtegePendentesContraDuplicidade):
 *  - PASSO 0: remove a exigencia de o guardador nunca ter tido agrupamento;
 *  - PASSO 1: nova branch para o agrupamento so em "Criado" e sem detalhe_a, de antes de ontem, que nao seja pai/filho,
 *    com usuario ativo e dados bancarios completos, sem ordem de hoje e sem ordem equivalente ja paga ou em pagamento.
 * Continuam de fora: usuario sem dados bancarios completos (precisa do cadastro) e usuario bloqueado.
 */
export class PendentesGuardadorOrdensNaoEnviadas1791600000000 implements MigrationInterface {
  name = 'PendentesGuardadorOrdensNaoEnviadas1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(PROCEDURE_GUARDADOR_NOVA);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(PROCEDURE_GUARDADOR_ANTERIOR);
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
    -- pendente (mesmo que o guardador ja tenha outros agrupamentos: antes so
    -- entrava quem nunca teve nenhum, e as ordens soltas dos demais ficavam
    -- paradas pra sempre). Cria 1 OPA + 1 oph (status 0) por usuario, somando o
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

        UNION ALL

        -- Agrupamento que foi CRIADO mas NUNCA entrou em nenhuma remessa (so historico "Criado", sem detalhe_a), por exemplo
        -- por falta de dados bancarios na epoca do preparo. Nao e rejeicao do banco, entao a primeira branch nao o enxerga.
        -- Fica de fora: o do dia anterior (ainda pode estar no ciclo normal, que envia no dia seguinte), o que ja e pai ou
        -- filho de outro agrupamento, o de usuario bloqueado ou sem dados bancarios completos, o com ordem de hoje e o com
        -- ordem equivalente ja paga ou em pagamento. Sem corte de data inicial, como as falhas reais.
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
            opa."pagadorId" = pagadorid
            AND opa."ordemPagamentoAgrupadoId" IS NULL
            AND opa."dataPagamento"::date < hoje - 1
            AND NOT (opa.id = ANY(freshOpaIds))
            AND pu."bloqueado" IS NOT TRUE
            AND pu."bankAccount" IS NOT NULL
            AND pu."bankAgency" IS NOT NULL
            AND pu."bankCode" IS NOT NULL
            AND pu."bankAccountDigit" IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM ordem_pagamento_agrupado ch WHERE ch."ordemPagamentoAgrupadoId" = opa.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM ordem_pagamento_agrupado_historico h
                WHERE h."ordemPagamentoAgrupadoId" = opa.id AND h."statusRemessa" <> 0
            )
            AND NOT EXISTS (
                SELECT 1 FROM ordem_pagamento_agrupado_historico h
                JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = h.id
                WHERE h."ordemPagamentoAgrupadoId" = opa.id
            )
            AND NOT EXISTS (
                SELECT 1 FROM ordem_pagamento_guardador x
                WHERE x."ordemPagamentoAgrupadoId" = opa.id
                  AND (date_trunc('day', x."dataOrdem") >= hoje
                       OR public.fn_ordem_guardador_ja_paga_ou_em_andamento(x.id))
            )
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

/** Definicao vigente antes desta migration (ProtegePendentesContraDuplicidade1791500000000). */
const PROCEDURE_GUARDADOR_ANTERIOR = `CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_guardador_pendente(IN datainicial date, IN datafinal date, IN datapagamento date, IN pagadorid integer)
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
