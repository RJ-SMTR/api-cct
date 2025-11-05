import { MigrationInterface, QueryRunner } from "typeorm";

export class HeaderArquivoAmbienteCliente1726076101399 implements MigrationInterface {
    name = 'HeaderArquivoAmbienteCliente1726076101399'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "header_arquivo_conf" ADD "ambienteCliente" character varying(2) NOT NULL DEFAULT 'P'`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "ambienteCliente" character varying(2) NOT NULL DEFAULT 'P'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "ambienteCliente"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo_conf" DROP COLUMN "ambienteCliente"`);
    }

}
