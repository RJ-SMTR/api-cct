import { MigrationInterface, QueryRunner } from "typeorm";

export class CnabSafeExtrato1726262584957 implements MigrationInterface {
    name = 'CnabSafeExtrato1726262584957'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "extrato_header_arquivo" ADD "retornoName" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "extrato_header_arquivo" DROP COLUMN "retornoName"`);
    }

}
