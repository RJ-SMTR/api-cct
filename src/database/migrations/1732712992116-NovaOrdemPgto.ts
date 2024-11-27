import { MigrationInterface, QueryRunner } from "typeorm";

export class NovaOrdemPgto1732712992116 implements MigrationInterface {
    name = 'NovaOrdemPgto1732712992116'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ordem_pagamento_agrupado" ("id" SERIAL NOT NULL, "userId" character varying NOT NULL, "userBankCode" character varying NOT NULL, "userBankAgency" character varying NOT NULL, "userBankAccount" character varying NOT NULL, "userBankAccountDigit" character varying NOT NULL, "dataPagamento" TIMESTAMP NOT NULL DEFAULT now(), "valorTotal" numeric(13,5) NOT NULL, "statusRemessa" character varying NOT NULL, "isPago" boolean NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_Ordem_Pagamento_Agrupado_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ordem_pagamento" ("id" integer NOT NULL, "dataOrdem" date NOT NULL, "nomeConsorcio" character varying(200), "nomeOperadora" character varying(200), "userId" integer NOT NULL, "valor" numeric(13,5) NOT NULL, "idOrdemPagamento" character varying, "idOperadora" character varying, "operadoraCpfCnpj" character varying, "idConsorcio" character varying, "consorcioCnpj" character varying, "bqUpdatedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ordemPgamentoAgrupadoId" integer, CONSTRAINT "PK_Ordem_Pagamento_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD CONSTRAINT "FK_OrdemPagamentoAgrupado_ManyToOne" FOREIGN KEY ("ordemPgamentoAgrupadoId") REFERENCES "ordem_pagamento_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP CONSTRAINT "FK_OrdemPagamentoAgrupado_ManyToOne"`);
        await queryRunner.query(`DROP TABLE "ordem_pagamento"`);
        await queryRunner.query(`DROP TABLE "ordem_pagamento_agrupado"`);
    }

}
