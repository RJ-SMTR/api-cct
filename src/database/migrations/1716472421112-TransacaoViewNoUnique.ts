import { MigrationInterface, QueryRunner } from "typeorm";

export class TransacaoViewNoUnique1716472421112 implements MigrationInterface {
    name = 'TransacaoViewNoUnique1716472421112'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP CONSTRAINT "UQ_TransacaoView_datetimeProcessamento"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD CONSTRAINT "UQ_TransacaoView_datetimeProcessamento" UNIQUE ("datetimeProcessamento")`);
    }

}
