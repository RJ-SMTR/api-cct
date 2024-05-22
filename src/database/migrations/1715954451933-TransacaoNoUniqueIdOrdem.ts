import { MigrationInterface, QueryRunner } from "typeorm";

export class TransacaoNoUniqueIdOrdem1715954451933 implements MigrationInterface {
    name = 'TransacaoNoUniqueIdOrdem1715954451933'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "UQ_Transacao_idOrdemPagamento"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "UQ_Transacao_idOrdemPagamento" UNIQUE ("idOrdemPagamento")`);
    }

}
