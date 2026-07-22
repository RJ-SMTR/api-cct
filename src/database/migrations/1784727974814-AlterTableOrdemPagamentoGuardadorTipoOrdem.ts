import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterTableOrdemPagamentoGuardadorTipoOrdem1784727974814 implements MigrationInterface {
    name = 'AlterTableOrdemPagamentoGuardadorTipoOrdem1784727974814'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "tipo_ordem_pagamento" varchar(100) NOT NULL`);        
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "tipo_ordem_pagamento"`);
    }

}
