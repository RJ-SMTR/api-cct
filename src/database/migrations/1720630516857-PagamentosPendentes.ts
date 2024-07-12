import { MigrationInterface, QueryRunner } from "typeorm";

export class PagamentosPendentes1720630516857 implements MigrationInterface {
    name = 'PagamentosPendentes1720630516857'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" ALTER COLUMN "modo" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" ALTER COLUMN "modo" DROP NOT NULL`);
    }

}
