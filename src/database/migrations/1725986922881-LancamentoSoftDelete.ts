import { MigrationInterface, QueryRunner } from "typeorm";

export class LancamentoSoftDelete1725986922881 implements MigrationInterface {
    name = 'LancamentoSoftDelete1725986922881'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "deletedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "deletedAt"`);
    }

}
