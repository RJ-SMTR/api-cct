import { MigrationInterface, QueryRunner } from "typeorm";

export class CnabSafeRetorno1726243209780 implements MigrationInterface {
    name = 'CnabSafeRetorno1726243209780'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "status" character varying NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "remessaName" character varying`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "retornoName" character varying`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "retornoDatetime" TIMESTAMP`);      
    }
    public async down(queryRunner: QueryRunner): Promise<void> {   
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "retornoDatetime"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "retornoName"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "remessaName"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "status"`);     
    }

}
