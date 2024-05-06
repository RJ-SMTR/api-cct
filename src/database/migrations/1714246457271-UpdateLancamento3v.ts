import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateLancamento3v1714246457271 implements MigrationInterface {
    name = 'UpdateLancamento3v1714246457271'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "valor"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "valor" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "anexo" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "anexo" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "valor"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "valor" character varying NOT NULL`);
    }

}
