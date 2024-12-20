import { MigrationInterface, QueryRunner } from "typeorm";

export class OrdemPagamentoUserIdNullable1734725681138 implements MigrationInterface {
    name = 'OrdemPagamentoUserIdNullable1734725681138'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD CONSTRAINT "FK_OrdemPagamentoAgrupado_ManyToOne" FOREIGN KEY ("ordemPagamentoAgrupadoId") REFERENCES "ordem_pagamento_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP CONSTRAINT "FK_OrdemPagamentoAgrupado_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ALTER COLUMN "userId" SET NOT NULL`);
    }

}
