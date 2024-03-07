import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArquivoPub1709840947523 implements MigrationInterface {
    name = 'AddArquivoPub1709840947523'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "arquivo_publicacao" ("id" SERIAL NOT NULL, "idTransacao" character varying NOT NULL, "idHeaderLote" character varying NOT NULL, "dataGeracaoRemessa" TIMESTAMP NOT NULL, "horaGeracaoRemessa" TIMESTAMP NOT NULL, "dataGeracaoRetorno" TIMESTAMP NOT NULL, "horaGeracaoRetorno" TIMESTAMP NOT NULL, "loteServico" character varying NOT NULL, "nomePagador" character varying NOT NULL, "agenciaPagador" character varying NOT NULL, "dvAgenciaPagador" character varying NOT NULL, "contaPagador" character varying NOT NULL, "dvContaPagador" character varying NOT NULL, "nomeCliente" character varying NOT NULL, "cpfCnpjCliente" character varying NOT NULL, "codigoBancoCliente" character varying NOT NULL, "agenciaCliente" character varying NOT NULL, "dvAgenciaCliente" character varying NOT NULL, "contaCorrenteCliente" character varying NOT NULL, "dvContaCorrenteCliente" character varying NOT NULL, "dtVencimento" character varying NOT NULL, "valorLancamento" character varying NOT NULL, "dataEfetivacao" character varying NOT NULL, "valorRealEfetivado" character varying NOT NULL, "ocorrencias" character varying, "headerArquivoId" integer, CONSTRAINT "PK_22de2aadff9e230e92bc4cb1ef6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "dataHoraGeracao"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "dataGeracao" character varying`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "horaGeracao" TIME`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "nsa" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD CONSTRAINT "UQ_785f0108ddcd63b34b2574b4a2d" UNIQUE ("nsa")`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "clienteFavorecido" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "FK_9034ea1202b6574b75a2304d419" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "FK_9034ea1202b6574b75a2304d419"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "clienteFavorecido" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP CONSTRAINT "UQ_785f0108ddcd63b34b2574b4a2d"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "nsa"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "horaGeracao"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "dataGeracao"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "dataHoraGeracao" character varying`);
        await queryRunner.query(`DROP TABLE "arquivo_publicacao"`);
    }

}
