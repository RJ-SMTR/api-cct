import { MigrationInterface, QueryRunner } from "typeorm";

export class OcorrenciaCode1715114151403 implements MigrationInterface {
    name = 'OcorrenciaCode1715114151403'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ocorrencia" DROP CONSTRAINT "UQ_6ff1f74718ae1fa9496becd4ffe"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ocorrencia" ADD CONSTRAINT "UQ_6ff1f74718ae1fa9496becd4ffe" UNIQUE ("code")`);
    }

}
