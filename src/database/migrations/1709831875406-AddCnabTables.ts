import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCnabTables1709831875406 implements MigrationInterface {
    name = 'AddCnabTables1709831875406'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cliente_favorecido" ("id" SERIAL NOT NULL, "nome" character varying(150) NOT NULL, "cpfCnpj" character varying(14), "codigoBanco" character varying(10), "agencia" character varying(5), "dvAgencia" character varying(2), "contaCorrente" character varying(12), "dvContaCorrente" character varying(2), "logradouro" character varying(200), "numero" character varying(15), "complemento" character varying(100), "bairro" character varying(150), "cidade" character varying(150), "cep" character varying(5), "complementoCep" character varying(3), "uf" character varying(2), CONSTRAINT "PK_fde4dc0b210ba36375b2adf9537" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "pagador" ("id" SERIAL NOT NULL, "nomeEmpresa" character varying(150) NOT NULL, "agencia" character varying(5), "dvAgencia" character varying(2), "conta" character varying(12), "dvConta" character varying(2), "logradouro" character varying(200), "numero" character varying(15), "complemento" character varying(100), "bairro" character varying(150), "cidade" character varying(150), "cep" character varying(5), "complementoCep" character varying(3), "uf" character varying(2), "cpfCnpj" character varying(2), CONSTRAINT "PK_f4f2b9f707df275194545243890" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "transacao" ("id" SERIAL NOT NULL, "dataOrdem" TIMESTAMP, "dataPagamento" TIMESTAMP, "nomeConsorcio" character varying(200), "nomeOperadora" character varying(200), "servico" character varying(150), "idOrdemPagamento" integer NOT NULL, "idOrdemRessarcimento" character varying(150), "quantidadeTransacaoRateioCredito" integer, "valorRateioCredito" numeric(10,2), "quantidadeTransacaoRateioDebito" integer, "valorRateioDebito" numeric(10,2), "quantidadeTotalTransacao" numeric(10,2), "valorTotalTransacaoBruto" integer, "valorDescontoTaxa" numeric(10,2), "valorTotalTransacaoLiquido" numeric(10,2), "quantidadeTotalTransacaoCaptura" integer, "valorTotalTransacaoCaptura" numeric(10,2), "indicadorOrdemValida" boolean, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "pagadorId" integer, CONSTRAINT "PK_8a60051729f5d7e2d49c8fa91c5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "header_arquivo" ("id" SERIAL NOT NULL, "tipoArquivo" character varying(100), "codigoBanco" character varying(10), "tipoInscricao" character varying(2), "numeroInscricao" character varying(14), "codigoConvenio" character varying(6), "parametroTransmissao" character varying(2), "agencia" character varying(5), "dvAgencia" character varying(1), "numeroConta" character varying(12), "dvConta" character varying(1), "nomeEmpresa" character varying(100), "dataHoraGeracao" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d7a8097c7ff853f854e14b3ecc8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "header_lote" ("id" SERIAL NOT NULL, "loteServico" character varying, "tipoInscricao" character varying, "numeroInscricao" character varying, "codigoConvenioBanco" character varying, "tipoCompromisso" character varying, "parametroTransmissao" character varying, "headerArquivoId" integer, "pagadorId" integer, CONSTRAINT "PK_9270a7bf4ac64c659baa292cdca" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "detalhe_a" ("id" SERIAL NOT NULL, "loteServico" character varying, "clienteFavorecido" integer, "tipoFinalidadeConta" character varying, "dataVencimento" TIMESTAMP, "tipoMoeda" character varying, "quantidadeMoeda" integer, "valorLancamento" character varying, "numeroDocumentoLancamento" character varying, "quantidadeParcelas" character varying, "indicadorBloqueio" character varying, "indicadorFormaParcelamento" character varying, "periodoVencimento" TIMESTAMP, "numeroParcela" character varying, "dataEfetivacao" TIMESTAMP, "valorRealEfetivado" integer, "nsr" integer NOT NULL, "ocorrencias" character varying(10), "headerLoteId" integer, CONSTRAINT "PK_0ece5ad3a5dc48173e507af0639" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "item_transacao" ("id" SERIAL NOT NULL, "dataTransacao" TIMESTAMP NOT NULL, "dataProcessamento" TIMESTAMP, "dataCaptura" TIMESTAMP, "modo" character varying(10), "nomeConsorcio" character varying(200), "valor" numeric(10,5), "transacaoId" integer, "clienteFavorecidoId" integer, CONSTRAINT "PK_1fba4427ea668b5fd4851ce6a01" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "FK_097c8d865615a7ec0516929b65f" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD CONSTRAINT "FK_cd9a79df522dbe1b057230614e9" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD CONSTRAINT "FK_75f6c2ed71c10935915157b45f9" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_7228a16907c82f80e733dcb465b" FOREIGN KEY ("headerLoteId") REFERENCES "header_lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_04f9231ba148125f267dd160196" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_67142ca27ead7b1bccbbc968c4b" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_67142ca27ead7b1bccbbc968c4b"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_04f9231ba148125f267dd160196"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_7228a16907c82f80e733dcb465b"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP CONSTRAINT "FK_75f6c2ed71c10935915157b45f9"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP CONSTRAINT "FK_cd9a79df522dbe1b057230614e9"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "FK_097c8d865615a7ec0516929b65f"`);
        await queryRunner.query(`DROP TABLE "item_transacao"`);
        await queryRunner.query(`DROP TABLE "detalhe_a"`);
        await queryRunner.query(`DROP TABLE "header_lote"`);
        await queryRunner.query(`DROP TABLE "header_arquivo"`);
        await queryRunner.query(`DROP TABLE "transacao"`);
        await queryRunner.query(`DROP TABLE "pagador"`);
        await queryRunner.query(`DROP TABLE "cliente_favorecido"`);
    }

}
