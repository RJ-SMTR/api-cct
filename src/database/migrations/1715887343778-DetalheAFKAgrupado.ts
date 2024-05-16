import { MigrationInterface, QueryRunner } from "typeorm";

export class DetalheAFKAgrupado1715887343778 implements MigrationInterface {
    name = 'DetalheAFKAgrupado1715887343778'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_itemTransacao_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "UQ_DetalheA_itemTransacao"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "itemTransacaoId"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "itemTransacaoAgrupadoId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne" FOREIGN KEY ("itemTransacaoAgrupadoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "itemTransacaoAgrupadoId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne" FOREIGN KEY ("itemTransacaoAgrupadoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "itemTransacaoId" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "UQ_DetalheA_itemTransacao" UNIQUE ("itemTransacaoId")`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_itemTransacao_OneToOne" FOREIGN KEY ("itemTransacaoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
