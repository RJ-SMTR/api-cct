import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterTableIdOrdemPagamento1784825963706 implements MigrationInterface {
    name = 'AlterTableIdOrdemPagamento1784825963706'

    public async up(queryRunner: QueryRunner): Promise<void> {     
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "tipoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "tipoOrdemPagamento" varchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "idOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "idOrdemPagamento" varchar(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "idOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "idOrdemPagamento" integer`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "tipoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "tipoOrdemPagamento" varchar(100) NOT NULL`);
       
    }

}
