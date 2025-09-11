import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTransacoesBqTable1757606311302 implements MigrationInterface {
    name = 'CreateTransacoesBqTable1757606311302'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."i_ordem_pagamento_agrupado"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_id_ordem_pagamento"`);
        await queryRunner.query(`DROP INDEX "public"."nomeConsorcioIdx"`);
        await queryRunner.query(`DROP INDEX "public"."dataPagamento_idx"`);
        await queryRunner.query(`DROP INDEX "public"."idx_historico_data_referencia_id_agrupado"`);
        await queryRunner.query(`DROP INDEX "public"."statusRemessa_idx"`);
        await queryRunner.query(`DROP INDEX "public"."detalhe_a_dataVencimento_ordemPagamentoHistoricoId"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "updatedAt" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "bloqueado" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "bloqueado" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "updatedAt" SET DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "detalhe_a_dataVencimento_ordemPagamentoHistoricoId" ON "detalhe_a" ("dataVencimento", "ordemPagamentoAgrupadoHistoricoId") `);
        await queryRunner.query(`CREATE INDEX "statusRemessa_idx" ON "ordem_pagamento_agrupado_historico" ("statusRemessa") `);
        await queryRunner.query(`CREATE INDEX "idx_historico_data_referencia_id_agrupado" ON "ordem_pagamento_agrupado_historico" ("dataReferencia", "ordemPagamentoAgrupadoId") `);
        await queryRunner.query(`CREATE INDEX "dataPagamento_idx" ON "ordem_pagamento_agrupado" ("dataPagamento") `);
        await queryRunner.query(`CREATE INDEX "nomeConsorcioIdx" ON "ordem_pagamento" ("nomeConsorcio") `);
        await queryRunner.query(`CREATE INDEX "idx_user_id_ordem_pagamento" ON "ordem_pagamento" ("userId") `);
        await queryRunner.query(`CREATE INDEX "i_ordem_pagamento_agrupado" ON "ordem_pagamento" ("ordemPagamentoAgrupadoId") `);
    }

}
