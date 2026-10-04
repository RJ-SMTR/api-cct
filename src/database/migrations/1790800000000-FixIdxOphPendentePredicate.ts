import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * AddIndexesRemessaAgrupamento1789522300000 already exists on `main` and has
 * very likely already run in production - this branch only edits that
 * migration's body, which TypeORM will never re-execute (it only checks the
 * migration name/timestamp, not its content), and even a re-run would be a
 * no-op because the original `CREATE INDEX IF NOT EXISTS` skips silently
 * when the index already exists, predicate mismatch or not.
 *
 * This migration exists purely to force the corrected idx_oph_pendente
 * predicate (`motivoStatusRemessa IS NULL OR ...`) into any environment
 * where the stale version already ran, by dropping and recreating it
 * unconditionally.
 *
 * ATENÇÃO ao aplicar em produção: mesma ressalva da migration original -
 * ordem_pagamento_agrupado_historico é grande e isso roda dentro de
 * transação, então "CONCURRENTLY" não é uma opção aqui. Recomendado recriar
 * o índice manualmente com CONCURRENTLY fora de janela de pico antes desta
 * migration rodar - o DROP/CREATE aqui viram no-op efetivo quando o índice
 * já estiver correto (predicado idêntico).
 */
export class FixIdxOphPendentePredicate1790800000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_oph_pendente;
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_oph_pendente
            ON ordem_pagamento_agrupado_historico ("ordemPagamentoAgrupadoId")
            WHERE "statusRemessa" NOT IN (3,5)
              AND ("motivoStatusRemessa" IS NULL OR "motivoStatusRemessa" NOT IN ('AM','00','BD'));
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_oph_pendente;
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_oph_pendente
            ON ordem_pagamento_agrupado_historico ("ordemPagamentoAgrupadoId")
            WHERE "statusRemessa" NOT IN (3,5) AND "motivoStatusRemessa" NOT IN ('AM','00','BD');
        `);
    }

}
