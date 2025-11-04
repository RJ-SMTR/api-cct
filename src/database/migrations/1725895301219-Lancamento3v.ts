import { MigrationInterface, QueryRunner } from "typeorm";

export class Lancamento3v1725895301219 implements MigrationInterface {
    name = 'Lancamento3v1725895301219'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "is_pago" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "is_pago"`);
    }

}
