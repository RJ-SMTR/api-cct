import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAgrupado1714686484049 implements MigrationInterface {
    name = 'CreateAgrupado1714686484049'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "item_transacao_agrupado" ("id" SERIAL NOT NULL, "dataProcessamento" TIMESTAMP NOT NULL DEFAULT now(), "dataCaptura" TIMESTAMP NOT NULL DEFAULT now(), "nomeConsorcio" character varying(200), "nomeOperadora" character varying(200), "valor" numeric(10,5), "idOrdemPagamento" character varying, "idOperadora" character varying, "idConsorcio" character varying, "dataLancamento" TIMESTAMP, "dataOrdem" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "transacaoAgrupadoId" integer, "clienteFavorecidoId" integer, "detalheAId" integer, "statusId" integer NOT NULL, CONSTRAINT "REL_63c0400df6a38aac8709c76430" UNIQUE ("detalheAId"), CONSTRAINT "PK_ItemTransacaoAgrupado_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "transacao_agrupado" ("id" SERIAL NOT NULL, "dataOrdem" TIMESTAMP, "dataPagamento" TIMESTAMP, "idOrdemPagamento" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "pagadorId" integer, "statusId" integer NOT NULL, CONSTRAINT "UQ_TransacaoAgrupado_idOrdemPagamento" UNIQUE ("idOrdemPagamento"), CONSTRAINT "PK_TransacaoAgrupado_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "transacaoAgrupadoId" integer`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "transacaoAgrupadoId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD CONSTRAINT "FK_ItemTransacaoAgrupado_transacaoAgrupado_ManyToOne" FOREIGN KEY ("transacaoAgrupadoId") REFERENCES "transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD CONSTRAINT "FK_ItemTransacaoAgrupado_clienteFavorecido_ManyToOne" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD CONSTRAINT "FK_ItemTransacaoAgrupado_detalheA_OneToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD CONSTRAINT "FK_ItemTransacaoAgrupado_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "item_transacao_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" ADD CONSTRAINT "FK_TransacaoAgrupado_pagador_ManyToOne" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" ADD CONSTRAINT "FK_TransacaoAgrupado_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "transacao_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD CONSTRAINT "FK_HeaderArquivo_transacaoAgrupado_ManyToOne" FOREIGN KEY ("transacaoAgrupadoId") REFERENCES "transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "FK_Transacao_transacaoAgrupado_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP CONSTRAINT "FK_HeaderArquivo_transacaoAgrupado_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" DROP CONSTRAINT "FK_TransacaoAgrupado_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "transacao_agrupado" DROP CONSTRAINT "FK_TransacaoAgrupado_pagador_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP CONSTRAINT "FK_ItemTransacaoAgrupado_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP CONSTRAINT "FK_ItemTransacaoAgrupado_detalheA_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP CONSTRAINT "FK_ItemTransacaoAgrupado_clienteFavorecido_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP CONSTRAINT "FK_ItemTransacaoAgrupado_transacaoAgrupado_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "transacaoAgrupadoId"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "transacaoAgrupadoId"`);
        await queryRunner.query(`DROP TABLE "transacao_agrupado"`);
        await queryRunner.query(`DROP TABLE "item_transacao_agrupado"`);
    }

}
