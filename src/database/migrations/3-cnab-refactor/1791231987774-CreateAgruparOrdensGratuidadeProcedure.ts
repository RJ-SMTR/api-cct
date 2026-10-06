import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Agrupamento da remessa de gratuidade: mesma regra de p_agrupar_ordens, mas o valor
 * do agrupamento vem de ordem_pagamento."valorGratuidade" e o vinculo e gravado em
 * ordem_pagamento."ordemPagamentoAgrupadoGratuidadeId" (nao toca em "ordemPagamentoAgrupadoId").
 */
export class CreateAgruparOrdensGratuidadeProcedure1791231987774 implements MigrationInterface {
    name = 'CreateAgruparOrdensGratuidadeProcedure1791231987774'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
CREATE OR REPLACE PROCEDURE public.p_agrupar_ordens_gratuidade(
    IN datainicial date,
    IN datafinal date,
    IN datapagamento date,
    IN pagadorid integer,
    IN consorcios character varying[])
LANGUAGE plpgsql
AS $$
DECLARE
    ordem RECORD;
    v_agrupado_id BIGINT;
BEGIN
    FOR ordem IN (
        SELECT id, "valorGratuidade" AS valor, "userId"
        FROM public.ordem_pagamento
        WHERE "userId" IS NOT NULL
          AND "valorGratuidade" IS NOT NULL
          AND "valorGratuidade" > 0
          AND date_trunc('day', "dataCaptura") BETWEEN dataInicial AND dataFinal
          AND "ordemPagamentoAgrupadoGratuidadeId" IS NULL
          AND (consorcios IS NULL OR "nomeConsorcio" = ANY(consorcios))
    )
    LOOP
        -- Usuario sem dados bancarios: pula a ordem
        IF EXISTS(SELECT 1 FROM "user"
                   WHERE ("bankAccount" IS NULL
                       OR "bankAgency" IS NULL
                       OR "bankCode" IS NULL
                       OR "bankAccountDigit" IS NULL)
                     AND id = ordem."userId") THEN
            RAISE INFO 'Usuario % nao possui dados bancarios para a ordem %', ordem."userId", ordem.id;
            CONTINUE;
        END IF;

        IF EXISTS(SELECT 1 FROM "user" WHERE id = ordem."userId" AND "bloqueado" IS TRUE) THEN
            RAISE INFO 'Usuario bloqueado %', ordem."userId";
            CONTINUE;
        END IF;

        v_agrupado_id := NULL;

        SELECT opa.id
        INTO v_agrupado_id
        FROM public.ordem_pagamento_agrupado opa
                 INNER JOIN public.ordem_pagamento op
                            ON opa.id = op."ordemPagamentoAgrupadoGratuidadeId"
        WHERE opa."dataPagamento" = datapagamento
          AND opa."pagadorId" = pagadorid
          AND op."userId" = ordem."userId"
          AND date_trunc('day', op."dataCaptura") BETWEEN dataInicial AND dataFinal
        LIMIT 1;

        IF v_agrupado_id IS NULL THEN
            INSERT INTO public.ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "pagadorId")
            VALUES (nextval('ordem_pagamento_agrupado_id_seq'), datapagamento, ordem.valor, current_timestamp, current_timestamp, pagadorid)
            RETURNING id INTO v_agrupado_id;

            INSERT INTO public.ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankAccountDigit",
                                                                   "userBankAccount", "userBankAgency", "userBankCode", "statusRemessa")
            SELECT nextval('ordem_pagamento_agrupado_historico_id_seq'), v_agrupado_id, datapagamento, u."bankAccountDigit",
                   u."bankAccount", u."bankAgency", u."bankCode", 0
            FROM public."user" u
            WHERE u.id = ordem."userId";

            RAISE INFO 'Adicionando ordem % ao agrupamento de gratuidade % que foi criado agora.', ordem.id, v_agrupado_id;
        ELSE
            RAISE INFO 'Adicionando ordem % ao agrupamento de gratuidade %', ordem.id, v_agrupado_id;

            UPDATE public.ordem_pagamento_agrupado
            SET "valorTotal" = "valorTotal" + ordem.valor,
                "updatedAt" = current_timestamp
            WHERE id = v_agrupado_id;
        END IF;

        UPDATE public.ordem_pagamento
        SET "ordemPagamentoAgrupadoGratuidadeId" = v_agrupado_id,
            "updatedAt" = current_timestamp
        WHERE id = ordem.id;
    END LOOP;
    COMMIT;
END
$$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP PROCEDURE IF EXISTS public.p_agrupar_ordens_gratuidade(date, date, date, integer, character varying[])`);
    }

}
