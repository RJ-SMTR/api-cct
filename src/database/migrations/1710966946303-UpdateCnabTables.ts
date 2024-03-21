import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCnabTables1710966946303 implements MigrationInterface {
    name = 'UpdateCnabTables1710966946303'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_b5a7c03d9250881766627229e5d"`);
        await queryRunner.query(`CREATE TABLE "transacao_status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_e22861c38f2137566319fe74bf6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "item_transacao_status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_c317b1ba52d80b9ededaa0cf814" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "userId" integer`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "UQ_0d5a5a996843f1f5e3f0e5ca380" UNIQUE ("userId")`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "idOperadora" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "idConsorcio" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "versaoOrdemPagamento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "statusId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "nomeOperadora" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "dataOrdem" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "versaoOrdemPagamento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "detalheAId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "UQ_611a02b09938bef0bc91cc85e86" UNIQUE ("detalheAId")`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "statusId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "servico" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorRateioCredito" TYPE numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorRateioDebito" TYPE numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "quantidadeTotalTransacao"`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "quantidadeTotalTransacao" integer`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "valorTotalTransacaoBruto"`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "valorTotalTransacaoBruto" numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorDescontoTaxa" TYPE numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorTotalTransacaoLiquido" TYPE numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorTotalTransacaoCaptura" TYPE numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "FK_0d5a5a996843f1f5e3f0e5ca380" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "FK_eb51c616e6345220c802d72aa1d" FOREIGN KEY ("statusId") REFERENCES "transacao_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_b5a7c03d9250881766627229e5d" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_611a02b09938bef0bc91cc85e86" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_823d11df70c736848428ee19478" FOREIGN KEY ("statusId") REFERENCES "item_transacao_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_823d11df70c736848428ee19478"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_611a02b09938bef0bc91cc85e86"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_b5a7c03d9250881766627229e5d"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "FK_eb51c616e6345220c802d72aa1d"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "FK_0d5a5a996843f1f5e3f0e5ca380"`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorTotalTransacaoCaptura" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorTotalTransacaoLiquido" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorDescontoTaxa" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "valorTotalTransacaoBruto"`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "valorTotalTransacaoBruto" integer`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "quantidadeTotalTransacao"`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "quantidadeTotalTransacao" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorRateioDebito" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "valorRateioCredito" TYPE numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "transacao" ALTER COLUMN "servico" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "UQ_611a02b09938bef0bc91cc85e86"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "detalheAId"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "versaoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "dataOrdem"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "nomeOperadora"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "versaoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "idConsorcio"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "idOperadora"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "UQ_0d5a5a996843f1f5e3f0e5ca380"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "userId"`);
        await queryRunner.query(`DROP TABLE "item_transacao_status"`);
        await queryRunner.query(`DROP TABLE "transacao_status"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_b5a7c03d9250881766627229e5d" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "header_lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
