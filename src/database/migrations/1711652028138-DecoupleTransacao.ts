import { MigrationInterface, QueryRunner } from "typeorm";

export class DecoupleTransacao1711652028138 implements MigrationInterface {
    name = 'DecoupleTransacao1711652028138'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "quantidadeTransacaoRateioCredito"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "valorRateioCredito"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "quantidadeTransacaoRateioDebito"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "valorRateioDebito"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "valorDescontoTaxa"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "valorTotalTransacaoLiquido"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "quantidadeTotalTransacaoCaptura"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "valorTotalTransacaoCaptura"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "indicadorOrdemValida"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "quantidadeTotalTransacao"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "valorTotalTransacaoBruto"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "idOrdemRessarcimento"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "idOperadora"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "idConsorcio"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "versaoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "nomeConsorcio"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "nomeOperadora"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "servico"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao" ADD "servico" character varying(150) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "nomeOperadora" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "nomeConsorcio" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "versaoOrdemPagamento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "idConsorcio" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "idOperadora" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "idOrdemRessarcimento" character varying(150)`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "valorTotalTransacaoBruto" numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "quantidadeTotalTransacao" integer`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "indicadorOrdemValida" boolean`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "valorTotalTransacaoCaptura" numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "quantidadeTotalTransacaoCaptura" integer`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "valorTotalTransacaoLiquido" numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "valorDescontoTaxa" numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "valorRateioDebito" numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "quantidadeTransacaoRateioDebito" integer`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "valorRateioCredito" numeric(10,3)`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "quantidadeTransacaoRateioCredito" integer`);
    }

}
