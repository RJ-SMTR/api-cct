import { MigrationInterface, QueryRunner } from "typeorm";

export class TransacaoUniqueIdCols1710267751807 implements MigrationInterface {
    name = 'TransacaoUniqueIdCols1710267751807'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "idOrdemPagamento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "idOperadora" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "idConsorcio" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "servico" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "idOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "idOrdemPagamento" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "idOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "idOrdemPagamento" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "servico"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "idConsorcio"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "idOperadora"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "idOrdemPagamento"`);
    }

}
