import { MigrationInterface, QueryRunner } from "typeorm"

export class AddValorGratuidadeOrdemPagamento1790725824001 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE ordem_pagamento
            ADD COLUMN IF NOT EXISTS "valorGratuidade" NUMERIC(13,5);
        `);

        await queryRunner.query(`
            ALTER TABLE ordem_pagamento
            ADD COLUMN IF NOT EXISTS "ordemPagamentoAgrupadoGratuidadeId" INTEGER;
        `);

        // Idempotente: o ambiente pode já ter a FK (colunas criadas antes desta migration).
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_OrdemPagamentoAgrupadoGratuidade_ManyToOne') THEN
                    ALTER TABLE ordem_pagamento
                    ADD CONSTRAINT "FK_OrdemPagamentoAgrupadoGratuidade_ManyToOne"
                    FOREIGN KEY ("ordemPagamentoAgrupadoGratuidadeId") REFERENCES ordem_pagamento_agrupado(id);
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ordem_pagamento DROP CONSTRAINT IF EXISTS "FK_OrdemPagamentoAgrupadoGratuidade_ManyToOne";`);
        await queryRunner.query(`ALTER TABLE ordem_pagamento DROP COLUMN IF EXISTS "ordemPagamentoAgrupadoGratuidadeId";`);
        await queryRunner.query(`ALTER TABLE ordem_pagamento DROP COLUMN IF EXISTS "valorGratuidade";`);
    }

}
