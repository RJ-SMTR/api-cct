import { MigrationInterface, QueryRunner } from "typeorm";

export class ItemTransacaoNewDate1710269582455 implements MigrationInterface {
    name = 'ItemTransacaoNewDate1710269582455'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "dataProcessamento" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "dataProcessamento" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "dataCaptura" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "dataCaptura" SET DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "dataCaptura" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "dataCaptura" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "dataProcessamento" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "dataProcessamento" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "createdAt"`);
    }

}
