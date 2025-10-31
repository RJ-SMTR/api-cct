import { MigrationInterface, QueryRunner } from "typeorm";

export class FixItemTransacao1710190728767 implements MigrationInterface {
    name = 'FixItemTransacao1710190728767'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "modo"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "modo" character varying(10)`);
    }

}
