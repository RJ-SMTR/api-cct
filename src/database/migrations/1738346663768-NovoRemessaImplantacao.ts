import { MigrationInterface, QueryRunner } from "typeorm";

export class NovoRemessaImplantacao1738346663768 implements MigrationInterface {
    name = 'NovoRemessaImplantacao1738346663768'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_ordem_pagamento_agrupado"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_historico_data_referencia_id_agrupado"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "itemTransacaoAgrupadoId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne" FOREIGN KEY ("itemTransacaoAgrupadoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "itemTransacaoAgrupadoId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne" FOREIGN KEY ("itemTransacaoAgrupadoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "idx_historico_data_referencia_id_agrupado" ON "ordem_pagamento_agrupado_historico" ("dataReferencia", "ordemPagamentoAgrupadoId") `);
        await queryRunner.query(`CREATE INDEX "idx_ordem_pagamento_agrupado" ON "ordem_pagamento" ("ordemPagamentoAgrupadoId") `);
    }

}
