import { MigrationInterface, QueryRunner } from "typeorm";

export class TransacaoViewCreateUpdatedAt1717442570102 implements MigrationInterface {
    name = 'TransacaoViewCreateUpdatedAt1717442570102'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP COLUMN "createdAt"`);
    }

}
