import { MigrationInterface, QueryRunner } from "typeorm";

export class AddValorGratuidadeOrdemPagamento1791225294530 implements MigrationInterface {
    name = 'AddValorGratuidadeOrdemPagamento1791225294530'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD "valorGratuidade" numeric(13,5)`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD "ordemPagamentoAgrupadoGratuidadeId" integer`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD CONSTRAINT "FK_OrdemPagamentoAgrupadoGratuidade_ManyToOne" FOREIGN KEY ("ordemPagamentoAgrupadoGratuidadeId") REFERENCES "ordem_pagamento_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP CONSTRAINT "FK_OrdemPagamentoAgrupadoGratuidade_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP COLUMN "ordemPagamentoAgrupadoGratuidadeId"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP COLUMN "valorGratuidade"`);
    }

}
