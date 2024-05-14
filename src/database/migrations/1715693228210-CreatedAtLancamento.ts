import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatedAtLancamento1715693228210 implements MigrationInterface {
    name = 'CreatedAtLancamento1715693228210'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" DROP COLUMN "updatedAt"`);
    }

}
