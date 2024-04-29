import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatePublicacao1714409896493 implements MigrationInterface {
    name = 'UpdatePublicacao1714409896493'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "valorLancamento"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "valorLancamento" numeric(13,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "valorLancamento"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "valorLancamento" character varying`);
    }

}
