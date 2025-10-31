import { MigrationInterface, QueryRunner } from "typeorm";

export class LancamentoHistory2v1726770695968 implements MigrationInterface {
    name = 'LancamentoHistory2v1726770695968'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "lancamento_history" ALTER COLUMN "status" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento_history" ALTER COLUMN "status" SET DEFAULT 'criado'`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "status" SET DEFAULT 'criado'`);
    }

}
