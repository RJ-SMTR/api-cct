import { MigrationInterface, QueryRunner } from "typeorm";

export class HistoricoAlterTable1736271782542 implements MigrationInterface {
    name = 'HistoricoAlterTable1736271782542'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ordem_pagamento" ("id" integer NOT NULL, "dataOrdem" date NOT NULL, "nomeConsorcio" character varying(200), "nomeOperadora" character varying(200), "userId" integer, "valor" numeric(13,5) NOT NULL, "idOrdemPagamento" character varying, "idOperadora" character varying, "operadoraCpfCnpj" character varying, "idConsorcio" character varying, "dataCaptura" TIMESTAMP, "bqUpdatedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ordemPagamentoAgrupadoId" integer, CONSTRAINT "PK_OrdemPagamentoId" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ordem_pagamento_agrupado" ("id" SERIAL NOT NULL, "valorTotal" numeric(13,5) NOT NULL, "dataPagamento" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "pagadorId" integer, CONSTRAINT "PK_OrdemPagamentoAgrupadoId" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ordem_pagamento_agrupado_historico" ("id" SERIAL NOT NULL, "dataReferencia" TIMESTAMP NOT NULL, "userBankCode" character varying NOT NULL, "userBankAgency" character varying NOT NULL, "userBankAccount" character varying NOT NULL, "userBankAccountDigit" character varying NOT NULL, "statusRemessa" integer NOT NULL, "motivoStatusRemessa" character varying, "ordemPagamentoAgrupadoId" integer, CONSTRAINT "PK_OrdemPagamentoAgrupadoHistoricoId" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" DROP COLUMN IF EXISTS "isUnico"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "ordemPagamentoAgrupadoHistoricoId" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "UQ_4acdbfdbf91744a2ef34d1ffcd7" UNIQUE ("ordemPagamentoAgrupadoHistoricoId")`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataPagamento"`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataPagamento" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataReferencia"`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataReferencia" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" TYPE numeric(10,5)`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" TYPE numeric(10,5)`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" TYPE numeric(10,5)`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_OrdemPagamentoAgrupadoHistorico_OneToOne" FOREIGN KEY ("ordemPagamentoAgrupadoHistoricoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {       
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_OrdemPagamentoAgrupadoHistorico_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" TYPE numeric`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" TYPE numeric`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" TYPE numeric`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataReferencia"`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataReferencia" date`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataPagamento"`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataPagamento" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "UQ_4acdbfdbf91744a2ef34d1ffcd7"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "ordemPagamentoAgrupadoHistoricoId"`);
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" ADD "isUnico" boolean`);
        await queryRunner.query(`DROP TABLE "ordem_pagamento_agrupado_historico"`);
        await queryRunner.query(`DROP TABLE "ordem_pagamento_agrupado"`);
        await queryRunner.query(`DROP TABLE "ordem_pagamento"`);
    }

}
