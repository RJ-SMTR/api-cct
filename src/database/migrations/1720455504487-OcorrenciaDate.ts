import { MigrationInterface, QueryRunner } from "typeorm";

export class OcorrenciaDate1720455504487 implements MigrationInterface {
    name = 'OcorrenciaDate1720455504487'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ocorrencia" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ocorrencia" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" DROP COLUMN "createdAt"`);
    }

}
