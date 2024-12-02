import { MigrationInterface, QueryRunner } from "typeorm";

export class TransacaoViewOrdemPagamento1733165003590 implements MigrationInterface {
    name = 'TransacaoViewOrdemPagamento1733165003590'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD "idOrdemPagamento" integer`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "dataPagamento" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "dataReferencia" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "dataReferencia" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "dataPagamento" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP COLUMN "idOrdemPagamento"`);
    }

}
