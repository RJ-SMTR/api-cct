import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueCnabColumns1712665866815 implements MigrationInterface {
    name = 'AddUniqueCnabColumns1712665866815'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "idOrdemPagamento" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "UQ_Transacao_idOrdemPagamento" UNIQUE ("idOrdemPagamento")`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "numeroDocumentoBanco"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "numeroDocumentoBanco" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "numeroDocumentoBanco"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "numeroDocumentoBanco" integer`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "UQ_Transacao_idOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "idOrdemPagamento" SET NOT NULL`);
    }

}
