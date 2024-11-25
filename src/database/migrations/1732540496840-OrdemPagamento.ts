import { MigrationInterface, QueryRunner } from "typeorm";

export class OrdemPagamento1732540496840 implements MigrationInterface {
    name = 'OrdemPagamento1732540496840'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ordem_pagamento_agrupado_entity" ("id" SERIAL NOT NULL, "userId" character varying NOT NULL, "userBankCode" character varying NOT NULL, "userBankAgency" character varying NOT NULL, "userBankAccount" character varying NOT NULL, "userBankAccountDig" character varying NOT NULL, "dataPagamento" TIMESTAMP NOT NULL DEFAULT now(), "ValorTotal" numeric(13,5), "ordensPagamento" character varying NOT NULL, "statusRemessa" character varying NOT NULL, "isPago" boolean, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_Ordem_Pagamento_Agrupado_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ordem_pagamento_entity" ("id" SERIAL NOT NULL, "dataOrdem" character varying NOT NULL, "nomeConsorcio" character varying(200), "nomeOperadora" character varying(200), "userId" character varying NOT NULL, "valor" numeric(13,5), "idOrdemPagamento" character varying, "idOperadora" character varying, "idConsorcio" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ordemPgamentoAgrupadoId" integer, CONSTRAINT "PK_Ordem_Pagamento_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" DROP COLUMN "isUnico"`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataPagamento"`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataPagamento" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataReferencia"`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataReferencia" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" TYPE numeric(10,5)`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" TYPE numeric(10,5)`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" TYPE numeric(10,5)`);
        await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_entity" ADD CONSTRAINT "FK_OrdemPagamentoAgrupado_ManyToOne" FOREIGN KEY ("ordemPgamentoAgrupadoId") REFERENCES "ordem_pagamento_agrupado_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_entity" DROP CONSTRAINT "FK_OrdemPagamentoAgrupado_ManyToOne"`);
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
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" ADD "isUnico" boolean`);
        await queryRunner.query(`DROP TABLE "ordem_pagamento_entity"`);
        await queryRunner.query(`DROP TABLE "ordem_pagamento_agrupado_entity"`);
    }

}
