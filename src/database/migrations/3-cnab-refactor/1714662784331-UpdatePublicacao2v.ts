import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatePublicacao2v1714662784331 implements MigrationInterface {
    name = 'UpdatePublicacao2v1714662784331'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "FK_ArquivoPublicacao_transacao_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "FK_ArquivoPublicacao_headerArquivo_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "favorecidoCpfCnpj"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "codigoBancoCliente"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dataGeracaoRemessa"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "nomeOperadora"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idHeaderLote"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "nomeCliente"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "nomeConsorcio"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "nomePagador"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idDetalheARetorno"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "loteServico"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "cpfCnpjCliente"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dvContaPagador"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "horaGeracaoRemessa"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "valorTotalTransacaoLiquido"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "contaCorrenteCliente"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idConsorcio"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "transacaoId"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dvContaCorrenteCliente"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "headerArquivoId"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dvAgenciaPagador"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "valorLancamento"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idOperadora"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "agenciaCliente"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dvAgenciaCliente"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dataOrdem"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "contaPagador"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "agenciaPagador"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idTransacao" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "itemTransacaoId" integer`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "UQ_ArquivoPublicao_ItemTransacao" UNIQUE ("itemTransacaoId")`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "FK_ArquivoPublicacao_itemTransacao_OneToOne" FOREIGN KEY ("itemTransacaoId") REFERENCES "item_transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "FK_ArquivoPublicacao_itemTransacao_OneToOne"`);
        await queryRunner.query(
          `ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "UQ_ArquivoPublicao_ItemTransacao"`,
        );
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "itemTransacaoId"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idTransacao"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "agenciaPagador" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "contaPagador" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dataOrdem" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dvAgenciaCliente" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idOrdemPagamento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "agenciaCliente" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idOperadora" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "valorLancamento" numeric(13,2)`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dvAgenciaPagador" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "headerArquivoId" integer`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dvContaCorrenteCliente" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "transacaoId" integer`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idConsorcio" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "contaCorrenteCliente" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "valorTotalTransacaoLiquido" numeric(13,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "horaGeracaoRemessa" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dvContaPagador" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "cpfCnpjCliente" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "loteServico" integer`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idDetalheARetorno" integer`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "nomePagador" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "nomeConsorcio" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "nomeCliente" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idHeaderLote" character varying`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "nomeOperadora" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dataGeracaoRemessa" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "codigoBancoCliente" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "favorecidoCpfCnpj" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "FK_ArquivoPublicacao_headerArquivo_ManyToOne" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "FK_ArquivoPublicacao_transacao_ManyToOne" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
