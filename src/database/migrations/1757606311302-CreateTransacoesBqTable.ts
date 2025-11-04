import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateTransacoesBqTable1757606311302 implements MigrationInterface {
    name = 'CreateTransacoesBqTable1757606311302'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: "transacoes_bq",
            columns: [
                {
                    name: "id_transacao",
                    type: "varchar",
                    length: "100",
                    isPrimary: true,
                },
                {
                    name: "data",
                    type: "date",
                    isNullable: true,
                },
                {
                    name: "datetime_transacao",
                    type: "timestamp",
                    isNullable: true,
                },
                {
                    name: "consorcio",
                    type: "varchar",
                    isNullable: true,
                },
                {
                    name: "valor_pagamento",
                    type: "decimal",
                    precision: 13,
                    scale: 5,
                    isNullable: false,
                },
                {
                    name: "id_ordem_pagamento",
                    type: "varchar",
                    isNullable: true,
                },
                {
                    name: "id_ordem_pagamento_consorcio_operador_dia",
                    type: "varchar",
                    isNullable: true,
                },
                {
                    name: "datetime_ultima_atualizacao",
                    type: "timestamp",
                    isNullable: true,
                },
                {
                    name: "tipo_transacao",
                    type: "varchar",
                    isNullable: true,
                },
            ],
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("transacoes_bq");
    }
}
