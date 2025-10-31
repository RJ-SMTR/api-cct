import { MigrationInterface, QueryRunner } from "typeorm";

export class PagamentosPendentes2v1725545132372 implements MigrationInterface {
    name = 'PagamentosPendentes2v1725545132372'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" ADD "dataReferencia" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" DROP COLUMN "dataReferencia"`);
    }

}
