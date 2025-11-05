import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateIndexDataReferenciaHistorico1737463762168 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`create index idx_historico_data_referencia_id_agrupado on ordem_pagamento_agrupado_historico("dataReferencia", "ordemPagamentoAgrupadoId");`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`drop index idx_historico_data_referencia_id_agrupado;`)
    }

}
