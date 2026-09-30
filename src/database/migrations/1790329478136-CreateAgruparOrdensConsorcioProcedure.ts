import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Move o agrupamento de ordens por consórcio (hoje feito em `PagamentoConsorcioRepository
 * .agruparPorConsorcio`, com um SELECT + INSERTs em blocos de 500 pela aplicação) para uma
 * procedure no banco, toda em SQL orientado a conjunto (sem loop linha a linha) — evita
 * milhares de idas e vindas entre app e banco, que é o que deixa o agrupamento de Modais
 * lento (dezenas de milhares de ordens por dia).
 */
export class CreateAgruparOrdensConsorcioProcedure1790329478136 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE PROCEDURE P_AGRUPAR_ORDENS_CONSORCIO(
                IN p_data_inicio DATE,
                IN p_data_fim DATE,
                IN p_data_pagamento DATE,
                IN p_pagador_id INT,
                IN p_consorcio VARCHAR,
                OUT p_agrupados INT,
                OUT p_sem_dados_bancarios INT,
                OUT p_bloqueados INT
            )
            LANGUAGE plpgsql
            AS $$
            BEGIN
                DROP TABLE IF EXISTS tmp_agrupar_consorcio;

                -- Um usuário elegível = tem ordem no período/consórcio, ainda não agrupada,
                -- não bloqueado e com os 4 dados bancários completos.
                CREATE TEMP TABLE tmp_agrupar_consorcio ON COMMIT DROP AS
                SELECT
                    op."userId" AS user_id,
                    SUM(op.valor) AS valor_total,
                    u."bankCode" AS bank_code,
                    u."bankAgency" AS bank_agency,
                    u."bankAccount" AS bank_account,
                    u."bankAccountDigit" AS bank_account_digit,
                    COALESCE(u."bankAccountType", 'corrente') AS bank_account_type,
                    nextval('ordem_pagamento_agrupado_id_seq') AS opa_id
                FROM ordem_pagamento op
                INNER JOIN "user" u ON u.id = op."userId"
                WHERE op."nomeConsorcio" = p_consorcio
                  AND op."ordemPagamentoAgrupadoId" IS NULL
                  AND op."userId" IS NOT NULL
                  AND date_trunc('day', op."dataCaptura") BETWEEN p_data_inicio AND p_data_fim
                  AND COALESCE(u.bloqueado, false) = false
                  AND u."bankCode" IS NOT NULL
                  AND u."bankAgency" IS NOT NULL AND u."bankAgency" <> ''
                  AND u."bankAccount" IS NOT NULL AND u."bankAccount" <> ''
                  AND u."bankAccountDigit" IS NOT NULL AND u."bankAccountDigit" <> ''
                GROUP BY op."userId", u."bankCode", u."bankAgency", u."bankAccount", u."bankAccountDigit", u."bankAccountType";

                SELECT count(*) INTO p_agrupados FROM tmp_agrupar_consorcio;

                SELECT count(DISTINCT op."userId") INTO p_bloqueados
                FROM ordem_pagamento op
                INNER JOIN "user" u ON u.id = op."userId"
                WHERE op."nomeConsorcio" = p_consorcio
                  AND op."ordemPagamentoAgrupadoId" IS NULL
                  AND op."userId" IS NOT NULL
                  AND date_trunc('day', op."dataCaptura") BETWEEN p_data_inicio AND p_data_fim
                  AND u.bloqueado IS TRUE;

                SELECT count(DISTINCT op."userId") INTO p_sem_dados_bancarios
                FROM ordem_pagamento op
                INNER JOIN "user" u ON u.id = op."userId"
                WHERE op."nomeConsorcio" = p_consorcio
                  AND op."ordemPagamentoAgrupadoId" IS NULL
                  AND op."userId" IS NOT NULL
                  AND date_trunc('day', op."dataCaptura") BETWEEN p_data_inicio AND p_data_fim
                  AND COALESCE(u.bloqueado, false) = false
                  AND (
                    u."bankCode" IS NULL
                    OR u."bankAgency" IS NULL OR u."bankAgency" = ''
                    OR u."bankAccount" IS NULL OR u."bankAccount" = ''
                    OR u."bankAccountDigit" IS NULL OR u."bankAccountDigit" = ''
                  );

                IF p_agrupados = 0 THEN
                    RETURN;
                END IF;

                INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "pagadorId")
                SELECT opa_id, p_data_pagamento, valor_total, now(), now(), p_pagador_id
                FROM tmp_agrupar_consorcio;

                UPDATE ordem_pagamento op
                SET "ordemPagamentoAgrupadoId" = g.opa_id
                FROM tmp_agrupar_consorcio g
                WHERE op."userId" = g.user_id
                  AND op."nomeConsorcio" = p_consorcio
                  AND op."ordemPagamentoAgrupadoId" IS NULL
                  AND date_trunc('day', op."dataCaptura") BETWEEN p_data_inicio AND p_data_fim;

                INSERT INTO ordem_pagamento_agrupado_historico
                    (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankAccountDigit", "userBankAccount", "userBankAgency", "userBankCode", "userBankAccountType", "statusRemessa")
                SELECT
                    nextval('ordem_pagamento_agrupado_historico_id_seq'),
                    opa_id,
                    now(),
                    bank_account_digit,
                    bank_account,
                    bank_agency,
                    bank_code::varchar,
                    bank_account_type,
                    0
                FROM tmp_agrupar_consorcio;
            END;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP PROCEDURE IF EXISTS P_AGRUPAR_ORDENS_CONSORCIO;`);
    }

}
