import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateLancamento1714005101337 implements MigrationInterface {
    name = 'UpdateLancamento1714005101337'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "anexo"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "anexo" character varying`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "algoritmo"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "algoritmo" character varying`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "glosa"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "glosa" character varying`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "recurso"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "recurso" character varying`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "valor_a_pagar"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "valor_a_pagar" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "numero_processo"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "numero_processo" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "numero_processo"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "numero_processo" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "valor_a_pagar"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "valor_a_pagar" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "recurso"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "recurso" integer`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "glosa"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "glosa" integer `);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "algoritmo"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "algoritmo" integer`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "anexo"`);
    }

}
