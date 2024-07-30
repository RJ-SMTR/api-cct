import { MigrationInterface, QueryRunner } from "typeorm";

export class Lancamento1722348299991 implements MigrationInterface {
    name = 'Lancamento1722348299991'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "photoId"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "transacaoId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "idOrdemPagamento" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "idOperadora" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "idConsorcio" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_Lancamento_transacao_ManyToOne" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_Lancamento_transacao_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "idConsorcio" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "idOperadora" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "idOrdemPagamento" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "transacaoId"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "photoId" uuid`);
    }

}
