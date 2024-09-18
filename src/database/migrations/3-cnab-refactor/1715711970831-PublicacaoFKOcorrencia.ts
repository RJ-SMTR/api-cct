import { MigrationInterface, QueryRunner } from "typeorm";

export class PublicacaoFKOcorrencia1715711970831 implements MigrationInterface {
    name = 'PublicacaoFKOcorrencia1715711970831'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "detalheAId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "UQ_ItemTransacao_detalheA" UNIQUE ("detalheAId")`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_ItemTransacao_detalheA_OneToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_ItemTransacao_detalheA_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "UQ_ItemTransacao_detalheA"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "detalheAId"`);
    }

}
