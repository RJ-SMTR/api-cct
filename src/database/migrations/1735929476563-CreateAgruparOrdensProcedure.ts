import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateAgruparOrdensProcedure1735929476563 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`
        CREATE OR REPLACE PROCEDURE P_AGRUPAR_ORDENS(IN dataInicial DATE,
                                  IN dataFinal DATE,
                                  IN dataPagamento DATE,
                                  IN pagadorId INT)
                LANGUAGE plpgsql
            AS $$
            DECLARE
                ordem RECORD;
                ordemPagamentoAgrupadoId BIGINT;
            BEGIN
                -- Loop para percorrer cada ordem de pagamento com userId nao nulo
                FOR ordem IN (
                    SELECT id, valor, "userId"
                    FROM public.ordem_pagamento
                    WHERE "userId" IS NOT NULL
                      AND "dataCaptura" BETWEEN dataInicial AND dataFinal
                      AND "ordemPagamentoAgrupadoId" IS NULL
                )
                    LOOP
                        SELECT opa.id
                        INTO ordemPagamentoAgrupadoId
                        FROM public.ordem_pagamento_agrupado opa
                        INNER JOIN public.ordem_pagamento op
                        on opa.id = op."ordemPagamentoAgrupadoId"
                        WHERE "dataPagamento" = dataPagamento
                        AND "userId" = ordem."userId"
                        LIMIT 1;
            
                        IF ordemPagamentoAgrupadoId IS NULL THEN
                            INSERT INTO public.ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "pagadorId")
                            VALUES (nextval('ordem_pagamento_agrupado_id_seq'), dataPagamento, ordem.valor, current_timestamp, current_timestamp, pagadorId)
                            RETURNING id INTO ordemPagamentoAgrupadoId;
            
                            UPDATE public.ordem_pagamento
                            SET "ordemPagamentoAgrupadoId" = ordemPagamentoAgrupadoId
                            WHERE id = ordem.id;
            
                            INSERT INTO public.ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankAccountDigit",
                                                                                   "userBankAccount", "userBankAgency", "userBankCode", "statusRemessa")
                            SELECT nextval('ordem_pagamento_agrupado_historico_id_seq'), ordemPagamentoAgrupadoId, current_timestamp, u."bankAccountDigit",
                                   u."bankAccount", u."bankAgency", u."bankCode", 1
                            FROM public."user" u
                            inner join ordem_pagamento op
                            on u.id = op."userId"
                            inner join ordem_pagamento_agrupado opa
                            on op."ordemPagamentoAgrupadoId" = opa.id
                            WHERE  opa.id = ordemPagamentoAgrupadoId;
            
                        ELSE
                            UPDATE public.ordem_pagamento_agrupado
                            SET "valorTotal" = "valorTotal" + ordem.valor,
                                "updatedAt" = current_timestamp
                            WHERE id = ordemPagamentoAgrupadoId;
            
                            UPDATE public.ordem_pagamento
                            SET "ordemPagamentoAgrupadoId" = ordemPagamentoAgrupadoId
                            WHERE id = ordem.id;
                        END IF;
            
                    END LOOP;
                COMMIT;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP PROCEDURE IF EXISTS P_AGRUPAR_ORDENS;
        `);
    }

}
