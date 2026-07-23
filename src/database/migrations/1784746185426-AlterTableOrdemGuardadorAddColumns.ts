import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterTableOrdemGuardadorAddColumns1784746185426 implements MigrationInterface {
    name = 'AlterTableOrdemGuardadorAddColumns1784746185426'

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD CONSTRAINT "PK_TransacaoView_id" PRIMARY KEY ("id")`);       
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "tipo_ordem_pagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "tipo_ordem_pagamento" varchar(100) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {       
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "tipo_ordem_pagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "tipo_ordem_pagamento" varchar(100) NOT NULL`);       
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "createdAt"`);        
    }

}
