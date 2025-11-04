import { MigrationInterface, QueryRunner } from "typeorm";

export class OrdemPagamentoDataCaptura1734714076564 implements MigrationInterface {
    name = 'OrdemPagamentoDataCaptura1734714076564'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ordem_pagamento_agrupado_historico" ("id" SERIAL NOT NULL, "dataReferencia" TIMESTAMP NOT NULL, "userBankCode" character varying NOT NULL, "userBankAgency" character varying NOT NULL, "userBankAccount" character varying NOT NULL, "userBankAccountDigit" character varying NOT NULL, "statusRemessa" integer NOT NULL, "motivoStatusRemessa" character varying, "ordemPagamentoAgrupadoId" integer, CONSTRAINT "PK_OrdemPagamentoAgrupadoHistoricoId" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP COLUMN "ordemPgamentoAgrupadoId"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP COLUMN "consorcioCnpj"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" DROP COLUMN "userBankAccount"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" DROP COLUMN "isPago"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" DROP COLUMN "userBankAgency"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" DROP COLUMN "userBankCode"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" DROP COLUMN "statusRemessa"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" DROP COLUMN "userBankAccountDigit"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD "dataCaptura" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD "ordemPagamentoAgrupadoId" integer`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "pagadorId" integer`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ALTER COLUMN "dataPagamento" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD CONSTRAINT "FK_OrdemPagamentoAgrupado_pagador_ManyToOne" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado_historico" ADD CONSTRAINT "FK_OrdemPagamentoAgrupadoHistorico_ordensPagamento_OneToMany" FOREIGN KEY ("ordemPagamentoAgrupadoId") REFERENCES "ordem_pagamento_agrupado_historico"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado_historico" DROP CONSTRAINT "FK_OrdemPagamentoAgrupadoHistorico_ordensPagamento_OneToMany"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" DROP CONSTRAINT "FK_OrdemPagamentoAgrupado_pagador_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ALTER COLUMN "dataPagamento" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" DROP COLUMN "pagadorId"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP COLUMN "ordemPagamentoAgrupadoId"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP COLUMN "dataCaptura"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "userBankAccountDigit" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "statusRemessa" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "userBankCode" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "userBankAgency" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "isPago" boolean NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "userId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ADD "userBankAccount" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD "consorcioCnpj" character varying`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD "ordemPgamentoAgrupadoId" integer`);
        await queryRunner.query(`DROP TABLE "ordem_pagamento_agrupado_historico"`);
    }

}
