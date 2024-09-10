import { MigrationInterface, QueryRunner } from "typeorm";

export class TransacaoViewCpfCnpj1716406551459 implements MigrationInterface {
    name = 'TransacaoViewCpfCnpj1716406551459'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD "operadoraCpfCnpj" character varying`);
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD "consorcioCnpj" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP COLUMN "consorcioCnpj"`);
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP COLUMN "operadoraCpfCnpj"`);
    }

}
