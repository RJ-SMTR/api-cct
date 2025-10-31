import { MigrationInterface, QueryRunner } from "typeorm";

export class LancamentoStatus1725912379556 implements MigrationInterface {
    name = 'LancamentoStatus1725912379556'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "status" character varying NOT NULL DEFAULT 'criado'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "status"`);
    }

}
