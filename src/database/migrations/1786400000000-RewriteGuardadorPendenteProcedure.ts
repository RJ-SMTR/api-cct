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
    novoAgrupadoId BIGINT;
BEGIN
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
