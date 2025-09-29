import { MigrationInterface, QueryRunner } from "typeorm";

export class AddColumnOpa1759166084304 implements MigrationInterface {
    name = 'AddColumnOpa1759166084304'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "ordemPagamentoAgrupadoId" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "ordemPagamentoAgrupadoId" integer`);
    }

}
