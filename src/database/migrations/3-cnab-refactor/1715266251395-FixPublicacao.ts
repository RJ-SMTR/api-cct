import { MigrationInterface, QueryRunner } from "typeorm";

export class FixPublicacao1715266251395 implements MigrationInterface {
    name = 'FixPublicacao1715266251395'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "valorRealEfetivado"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "valorRealEfetivado" numeric`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "valorRealEfetivado"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "valorRealEfetivado" character varying`);
    }

}
