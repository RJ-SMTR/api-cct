import { MigrationInterface, QueryRunner } from "typeorm";

export class FixOrdemPagamentoAgrupadoFK1734982901641 implements MigrationInterface {
    name = 'FixOrdemPagamentoAgrupadoFK1734982901641'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado_historico" DROP CONSTRAINT "FK_OrdemPagamentoAgrupadoHistorico_ordensPagamento_OneToMany"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado_historico" ADD CONSTRAINT "FK_OrdemPagamentoAgrupadoHistorico_ordensPagamento_OneToMany" FOREIGN KEY ("ordemPagamentoAgrupadoId") REFERENCES "ordem_pagamento_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado_historico" DROP CONSTRAINT "FK_OrdemPagamentoAgrupadoHistorico_ordensPagamento_OneToMany"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado_historico" ADD CONSTRAINT "FK_OrdemPagamentoAgrupadoHistorico_ordensPagamento_OneToMany" FOREIGN KEY ("ordemPagamentoAgrupadoId") REFERENCES "ordem_pagamento_agrupado_historico"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
