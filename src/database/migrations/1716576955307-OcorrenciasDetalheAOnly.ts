import { MigrationInterface, QueryRunner } from "typeorm";

export class OcorrenciasDetalheAOnly1716576955307 implements MigrationInterface {
    name = 'OcorrenciasDetalheAOnly1716576955307'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ocorrencia" DROP CONSTRAINT "FK_TransacaoOcorrencia_headerLote_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP COLUMN "ocorrenciasCnab"`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" DROP COLUMN "headerLoteId"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "ocorrenciasCnab"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "ocorrenciasCnab" character varying(30)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "ocorrenciasCnab"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "ocorrenciasCnab" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" ADD "headerLoteId" integer`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD "ocorrenciasCnab" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" ADD CONSTRAINT "FK_TransacaoOcorrencia_headerLote_ManyToOne" FOREIGN KEY ("headerLoteId") REFERENCES "header_lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
