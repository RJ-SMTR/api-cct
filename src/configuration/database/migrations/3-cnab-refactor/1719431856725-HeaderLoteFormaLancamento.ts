import { MigrationInterface, QueryRunner } from "typeorm";

export class HeaderLoteFormaLancamento1719431856725 implements MigrationInterface {
    name = 'HeaderLoteFormaLancamento1719431856725'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "header_lote" ADD "formaLancamento" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "header_lote" DROP COLUMN "formaLancamento"`);
    }

}
