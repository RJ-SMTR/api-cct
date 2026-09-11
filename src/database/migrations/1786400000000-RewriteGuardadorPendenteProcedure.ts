import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reescreve p_agrupar_ordens_guardador_pendente no MESMO modelo da
 * p_agrupar_ordens_estornos_rejeitados (ver 1786320000000).
 *
 * A versao anterior estava copiada da p_agrupar_ordens (agrupamento inicial):
 *  - loop 1x por ordem_pagamento_guardador, criando um oph a cada iteracao no
 *    ramo ELSE -> multiplos oph por OPA;
 *  - cursor sem DISTINCT (JOIN em ordem_pagamento_agrupado_historico) ->
 *    a mesma ordem contava M vezes o valorRepasse quando a OPA tinha M oph;
 *  - re-vinculava a ORDEM (ordem_pagamento_guardador.ordemPagamentoAgrupadoId),
 *    nao criava relacao pai/filha entre OPAs;
 *  - NOT EXISTS interno joinava ordem_pagamento (consorcio) por engano.
 *
 * Nova versao (fase 0 acordada):
 *  - agrupa por userId, SUM(da.valorRealEfetivado), array_agg(DISTINCT opa_id);
 *  - 1 OPA pai por usuario, filhas = OPAs antigas
 *    (UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = pai);
 *  - 1 oph pai (statusRemessa 0) + 1 oph por filha (statusRemessa 0);
 *  - criterio de pendencia igual ao consorcio: motivoStatusRemessa NOT IN
 *    ('AM','00','BD'), statusRemessa NOT IN (3,5), da.dataVencimento na janela;
 *  - sem idOperadoras (assinatura fica com 4 params);
 *  - NAO toca em ordem_pagamento_guardador."ordemPagamentoAgrupadoId".
 *
 * Ainda nao ha caller: o wiring (service + CronJobsService.pagamentoPendentesGuardadoresExec)
 * e o suporte no findAllPendente/getDetalheARetorno vem nas fases seguintes.
 *
 * Fix 2026-09-11 #1 (teste manual com dado real, janela 01/07-08/09): o filtro
 * "pu.bloqueado = FALSE" copiado da p_agrupar_ordens_estornos_rejeitados excluia
 * silenciosamente ~84% dos usuarios guardador (177/211 tem bloqueado NULL, contra
 * ~1% no consorcio) - NULL = FALSE avalia NULL em SQL, nao TRUE. Zero pendencias
 * eram agrupadas. Trocado para "bloqueado IS NOT TRUE" (mesma semantica da
 * procedure antiga de prod, que pulava so quem tinha bloqueado IS TRUE).
 *
 * Fix 2026-09-11 #2 (decisao do dono, comparando com o arquivo real de prod de
 * 09/09): "pendente" pra guardador tambem inclui ordem_pagamento_guardador que
 * NUNCA foram agrupadas (ordemPagamentoAgrupadoId IS NULL) - nao so falhas
 * anteriores. Motivo: no fluxo normal (contaRotativo) rodado manualmente em
 * prod, ordens novas de usuarios com falha antiga acabavam grudadas na mesma
 * OPA nunca resolvida em vez de virar uma tentativa nova - exatamente o buraco
 * que este fluxo deveria fechar.
 *
 * PASSO 0 (novo): pra cada usuario com ordem_pagamento_guardador solta
 * (ordemPagamentoAgrupadoId IS NULL) na janela de dataOrdem, cria uma OPA +
 * 1 oph (statusRemessa 0, sem detalhe_a ainda) somando o valorRepasseGuardador
 * - igual o fluxo normal faria - e linka a(s) ordem(ns) nela. Isso da a essas
 * ordens a MESMA forma de uma OPA que ja tentou e falhou (decisao acordada:
 * filha pra todo mundo, nunca ordem_pagamento_guardador direto no pai, pra nao
 * criar caso hibrido que o getHistoricoDetalheA/getDetalheARetorno nao cobrem
 * quando um usuario tem os dois casos ao mesmo tempo).
 *
 * PASSO 1 (o de sempre): o CTE "agrupado" veio de UNION ALL de duas origens -
 * falhas antigas (via detalhe_a.valorRealEfetivado, como antes) e as OPAs
 * frescas do passo 0 (via opa.valorTotal, sem detalhe_a) - disjuntas por
 * construcao (fresca nunca tem detalhe_a na mesma execucao que foi criada).
 * Dai em diante e o mesmo agrupamento pai/filha de sempre.
 *
 * Fix 2026-09-11 #3 (erro real ao rodar): o PASSO 0 nao verificava se o
 * usuario tinha dado bancario completo antes de inserir o oph - `p_agrupar_
 * ordens_guardador` (fluxo normal) pula esses usuarios, mas eu esqueci de
 * copiar esse filtro, e o INSERT em ordem_pagamento_agrupado_historico estourou
 * "null value in column userBankCode" pra usuario sem conta cadastrada. Filtro
 * bankAccount/bankAgency/bankCode/bankAccountDigit IS NOT NULL adicionado.
 *
 * Fix 2026-09-11 #4 (comparacao com o arquivo real de prod de 09/09): o PASSO 0
 * so olhava "esta solta NESSA janela" - isso pegava tambem usuario do ciclo
 * normal cuja ordem da semana simplesmente ainda nao tinha sido processada
 * localmente (sem falha, sem nunca-agrupado de verdade). 6 dessas pessoas
 * vazaram pra dentro da remessa de pendentes num teste real. Adicionado
 * "NOT EXISTS ordem_pagamento_guardador com ordemPagamentoAgrupadoId IS NOT
 * NULL" pro usuario inteiro (todo o historico, nao so a janela) - so entra
 * quem NUNCA teve nenhuma ordem agrupada.
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
            da."dataVencimento" BETWEEN datainicial AND datafinal
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
    // A versao anterior estava quebrada e sem caller; rollback = remover.
    await queryRunner.query(
      `DROP PROCEDURE IF EXISTS public.p_agrupar_ordens_guardador_pendente(date, date, date, integer)`,
    );
  }
}
