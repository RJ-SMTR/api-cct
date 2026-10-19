import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Adiciona o modo "gratuidade" ao agrupamento de ordens por consórcio/modal: quando
 * `p_gratuidade` é true, agrupa somando `ordem_pagamento."valorGratuidade"` (em vez de
 * "valor") e marca o vínculo em `ordem_pagamento."ordemPagamentoAgrupadoGratuidadeId"` (em
 * vez de "ordemPagamentoAgrupadoId") — assim uma mesma ordem pode participar do
 * agrupamento normal E do de gratuidade de forma independente, sem um "roubar" a ordem do
 * outro. A troca de pagador (CETT) é decidida pela aplicação (não aqui): quem chama a
 * procedure já passa o pagadorId certo em `p_pagador_id`.
 */
export class AddGratuidadeAgruparOrdensConsorcio1790726574443 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP PROCEDURE IF EXISTS P_AGRUPAR_ORDENS_CONSORCIO(date, date, date, integer, character varying);
        `);

        await queryRunner.query(`
            CREATE OR REPLACE PROCEDURE P_AGRUPAR_ORDENS_CONSORCIO(
                IN p_data_inicio DATE,
                IN p_data_fim DATE,
                IN p_data_pagamento DATE,
                IN p_pagador_id INT,
                IN p_consorcio VARCHAR,
                IN p_gratuidade BOOLEAN,
                OUT p_agrupados INT,
                OUT p_sem_dados_bancarios INT,
                OUT p_bloqueados INT
            )
            LANGUAGE plpgsql
            AS $$
            BEGIN
                DROP TABLE IF EXISTS tmp_agrupar_consorcio;

                IF p_gratuidade THEN
                    CREATE TEMP TABLE tmp_agrupar_consorcio ON COMMIT DROP AS
                    SELECT
                        op."userId" AS user_id,
                        SUM(op."valorGratuidade") AS valor_total,
                        u."bankCode" AS bank_code,
                        u."bankAgency" AS bank_agency,
                        u."bankAccount" AS bank_account,
                        u."bankAccountDigit" AS bank_account_digit,
                        COALESCE(u."bankAccountType", 'corrente') AS bank_account_type,
                        nextval('ordem_pagamento_agrupado_id_seq') AS opa_id
                    FROM ordem_pagamento op
                    INNER JOIN "user" u ON u.id = op."userId"
                    WHERE op."nomeConsorcio" = p_consorcio
                      AND op."ordemPagamentoAgrupadoGratuidadeId" IS NULL
                      AND op."userId" IS NOT NULL
                      AND op."valorGratuidade" IS NOT NULL
                      AND date_trunc('day', op."dataCaptura") BETWEEN p_data_inicio AND p_data_fim
                      AND COALESCE(u.bloqueado, false) = false
                      AND u."bankCode" IS NOT NULL
                      AND u."bankAgency" IS NOT NULL AND u."bankAgency" <> ''
                      AND u."bankAccount" IS NOT NULL AND u."bankAccount" <> ''
                      AND u."bankAccountDigit" IS NOT NULL AND u."bankAccountDigit" <> ''
                    GROUP BY op."userId", u."bankCode", u."bankAgency", u."bankAccount", u."bankAccountDigit", u."bankAccountType";
                ELSE
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
                END IF;

                SELECT count(*) INTO p_agrupados FROM tmp_agrupar_consorcio;

                IF p_gratuidade THEN
                    SELECT count(DISTINCT op."userId") INTO p_bloqueados
                    FROM ordem_pagamento op
                    INNER JOIN "user" u ON u.id = op."userId"
                    WHERE op."nomeConsorcio" = p_consorcio
                      AND op."ordemPagamentoAgrupadoGratuidadeId" IS NULL
                      AND op."userId" IS NOT NULL
                      AND op."valorGratuidade" IS NOT NULL
                      AND date_trunc('day', op."dataCaptura") BETWEEN p_data_inicio AND p_data_fim
                      AND u.bloqueado IS TRUE;

                    SELECT count(DISTINCT op."userId") INTO p_sem_dados_bancarios
                    FROM ordem_pagamento op
                    INNER JOIN "user" u ON u.id = op."userId"
                    WHERE op."nomeConsorcio" = p_consorcio
                      AND op."ordemPagamentoAgrupadoGratuidadeId" IS NULL
                      AND op."userId" IS NOT NULL
                      AND op."valorGratuidade" IS NOT NULL
                      AND date_trunc('day', op."dataCaptura") BETWEEN p_data_inicio AND p_data_fim
                      AND COALESCE(u.bloqueado, false) = false
                      AND (
                        u."bankCode" IS NULL
                        OR u."bankAgency" IS NULL OR u."bankAgency" = ''
                        OR u."bankAccount" IS NULL OR u."bankAccount" = ''
                        OR u."bankAccountDigit" IS NULL OR u."bankAccountDigit" = ''
                      );
                ELSE
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
                END IF;

                IF p_agrupados = 0 THEN
                    RETURN;
                END IF;

                INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "pagadorId")
                SELECT opa_id, p_data_pagamento, valor_total, now(), now(), p_pagador_id
                FROM tmp_agrupar_consorcio;

                IF p_gratuidade THEN
                    UPDATE ordem_pagamento op
                    SET "ordemPagamentoAgrupadoGratuidadeId" = g.opa_id
                    FROM tmp_agrupar_consorcio g
                    WHERE op."userId" = g.user_id
                      AND op."nomeConsorcio" = p_consorcio
                      AND op."ordemPagamentoAgrupadoGratuidadeId" IS NULL
                      AND op."valorGratuidade" IS NOT NULL
                      AND date_trunc('day', op."dataCaptura") BETWEEN p_data_inicio AND p_data_fim;
                ELSE
                    UPDATE ordem_pagamento op
                    SET "ordemPagamentoAgrupadoId" = g.opa_id
                    FROM tmp_agrupar_consorcio g
                    WHERE op."userId" = g.user_id
                      AND op."nomeConsorcio" = p_consorcio
                      AND op."ordemPagamentoAgrupadoId" IS NULL
                      AND date_trunc('day', op."dataCaptura") BETWEEN p_data_inicio AND p_data_fim;
                END IF;

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
        await queryRunner.query(`DROP PROCEDURE IF EXISTS P_AGRUPAR_ORDENS_CONSORCIO(date, date, date, integer, character varying, boolean);`);

        // Restaura a assinatura anterior (sem gratuidade), igual à migration original.
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

}
