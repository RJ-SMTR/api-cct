import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateItemTransacao1715188684545 implements MigrationInterface {
    name = 'UpdateItemTransacao1715188684545'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "valor" TYPE numeric(13,5)`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ALTER COLUMN "valor" TYPE numeric(13,5)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ALTER COLUMN "valor" TYPE numeric(10,5)`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ALTER COLUMN "valor" TYPE numeric(10,5)`);
    }

}
