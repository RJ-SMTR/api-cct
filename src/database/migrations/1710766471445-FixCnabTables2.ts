import { MigrationInterface, QueryRunner } from "typeorm";

export class FixCnabTables21710766471445 implements MigrationInterface {
    name = 'FixCnabTables21710766471445'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dtVencimento"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "data_lancamento" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dataVencimento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idDetalheARetorno" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "dataGeracao"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "dataGeracao" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP COLUMN "loteServico"`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD "loteServico" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "quantidadeMoeda"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "quantidadeMoeda" numeric(5,10)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "quantidadeMoeda"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "quantidadeMoeda" integer`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP COLUMN "loteServico"`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD "loteServico" character varying`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "dataGeracao"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "dataGeracao" character varying`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idDetalheARetorno"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dataVencimento"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "data_lancamento"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dtVencimento" character varying NOT NULL`);
    }

}
