import { MigrationInterface, QueryRunner } from "typeorm";

export class TransacaoViewOrdemPagamento1733170485242 implements MigrationInterface {
    name = 'TransacaoViewOrdemPagamento1733170485242'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD "idOrdemPagamento" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP COLUMN "idOrdemPagamento"`);
    }

}
