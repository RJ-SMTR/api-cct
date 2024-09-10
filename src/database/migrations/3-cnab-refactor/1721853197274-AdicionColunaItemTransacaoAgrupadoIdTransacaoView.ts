import { MigrationInterface, QueryRunner } from "typeorm";

export class AdicionColunaItemTransacaoAgrupadoIdTransacaoView1721853197274 implements MigrationInterface {
    name = 'AdicionColunaItemTransacaoAgrupadoIdTransacaoView1721853197274'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "idTransacaoView"`);
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD "itemTransacaoAgrupadoId" numeric`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP COLUMN "itemTransacaoAgrupadoId"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "idTransacaoView" character varying`);
    }

}
