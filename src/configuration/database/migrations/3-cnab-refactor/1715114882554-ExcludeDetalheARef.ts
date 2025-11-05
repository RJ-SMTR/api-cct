import { MigrationInterface, QueryRunner } from "typeorm";

export class ExcludeDetalheARef1715114882554 implements MigrationInterface {
    name = 'ExcludeDetalheARef1715114882554'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP CONSTRAINT "FK_ItemTransacaoAgrupado_detalheA_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_ItemTransacao_detalheA_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP CONSTRAINT "REL_63c0400df6a38aac8709c76430"`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP COLUMN "detalheAId"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "UQ_ItemTransacao_detalheA"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "detalheAId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "detalheAId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "UQ_ItemTransacao_detalheA" UNIQUE ("detalheAId")`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD "detalheAId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD CONSTRAINT "REL_63c0400df6a38aac8709c76430" UNIQUE ("detalheAId")`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_ItemTransacao_detalheA_OneToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD CONSTRAINT "FK_ItemTransacaoAgrupado_detalheA_OneToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
