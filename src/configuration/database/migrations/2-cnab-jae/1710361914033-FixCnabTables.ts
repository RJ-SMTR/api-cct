import { MigrationInterface, QueryRunner } from "typeorm";

export class FixCnabTables1710361914033 implements MigrationInterface {
    name = 'FixCnabTables1710361914033'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "clienteFavorecido"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "clienteFavorecidoId" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "valorLancamento"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "valorLancamento" numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "valorRealEfetivado"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "valorRealEfetivado" numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_b5a7c03d9250881766627229e5d" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "header_lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_b5a7c03d9250881766627229e5d"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "valorRealEfetivado"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "valorRealEfetivado" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "valorLancamento"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "valorLancamento" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "clienteFavorecidoId"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "clienteFavorecido" integer NOT NULL`);
    }

}
