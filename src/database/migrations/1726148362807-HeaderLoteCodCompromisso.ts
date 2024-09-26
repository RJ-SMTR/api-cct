import { MigrationInterface, QueryRunner } from "typeorm";

export class HeaderLoteCodCompromisso1726148362807 implements MigrationInterface {
    name = 'HeaderLoteCodCompromisso1726148362807'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "header_lote_conf" ADD "codigoCompromisso" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD "codigoCompromisso" integer NOT NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "header_lote" DROP COLUMN "codigoCompromisso"`);
        await queryRunner.query(`ALTER TABLE "header_lote_conf" DROP COLUMN "codigoCompromisso"`);
    }

}
