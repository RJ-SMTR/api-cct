import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterTableAddIdOrdemGuardador1784809926819 implements MigrationInterface {
    name = 'AlterTableAddIdOrdemGuardador1784809926819'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "idOrdemPagamento" integer`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "tipoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "tipoOrdemPagamento" varchar(100) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {       
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "tipoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "tipoOrdemPagamento" varchar(100) NOT NULL`);        
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "idOrdemPagamento"`);       
    }

}
