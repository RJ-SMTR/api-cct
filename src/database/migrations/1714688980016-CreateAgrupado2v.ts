import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAgrupado2v1714688980016 implements MigrationInterface {
    name = 'CreateAgrupado2v1714688980016'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" DROP CONSTRAINT "UQ_TransacaoAgrupado_idOrdemPagamento"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" ADD CONSTRAINT "UQ_TransacaoAgrupado_idOrdemPagamento" UNIQUE ("idOrdemPagamento")`);
    }

}
