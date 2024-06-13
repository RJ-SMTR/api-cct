import { MigrationInterface, QueryRunner } from "typeorm";

export class TransacaoViewValorPago1718128591022 implements MigrationInterface {
    name = 'TransacaoViewValorPago1718128591022'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD "valorPago" numeric`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP COLUMN "valorPago"`);
    }
}
