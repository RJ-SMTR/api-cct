import { MigrationInterface, QueryRunner } from "typeorm";

export class SettingUpdatedAt1726076946098 implements MigrationInterface {
    name = 'SettingUpdatedAt1726076946098'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "setting" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "setting" DROP COLUMN "updatedAt"`);
    }

}
