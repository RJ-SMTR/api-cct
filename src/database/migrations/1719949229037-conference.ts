import { MigrationInterface, QueryRunner } from "typeorm";

export class Conference1719949229037 implements MigrationInterface {
    name = 'Conference1719949229037'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "header_arquivo_conf" ("id" SERIAL NOT NULL, "tipoArquivo" integer NOT NULL, "codigoBanco" character varying(3), "tipoInscricao" character varying(2), "numeroInscricao" character varying(14), "codigoConvenio" character varying(6), "parametroTransmissao" character varying(2), "agencia" character varying(5), "dvAgencia" character varying(1), "numeroConta" character varying(12), "dvConta" character varying(1), "nomeEmpresa" character varying(100), "dataGeracao" TIMESTAMP, "horaGeracao" TIME, "nsa" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "transacaoId" integer, "transacaoAgrupadoId" integer, CONSTRAINT "PK_HeaderArquivoConf_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "header_lote_conf" ("id" SERIAL NOT NULL, "loteServico" integer, "tipoInscricao" character varying, "numeroInscricao" character varying, "codigoConvenioBanco" character varying, "tipoCompromisso" character varying, "parametroTransmissao" character varying, "formaLancamento" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "headerArquivoId" integer, "pagadorId" integer, CONSTRAINT "PK_HeaderLoteConf_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "detalhe_a_conf" ("id" SERIAL NOT NULL, "ocorrenciasCnab" character varying(30), "loteServico" integer, "finalidadeDOC" character varying, "numeroDocumentoEmpresa" integer NOT NULL, "dataVencimento" TIMESTAMP, "tipoMoeda" character varying, "quantidadeMoeda" numeric(10,5), "valorLancamento" numeric(13,2), "numeroDocumentoBanco" character varying, "quantidadeParcelas" integer, "indicadorBloqueio" character varying, "indicadorFormaParcelamento" character varying, "periodoVencimento" TIMESTAMP, "numeroParcela" integer, "dataEfetivacao" TIMESTAMP, "valorRealEfetivado" numeric(13,2), "nsr" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "headerLoteId" integer, "clienteFavorecidoId" integer, "itemTransacaoAgrupadoId" integer NOT NULL, CONSTRAINT "REL_5a006e496627c740a941d4b48a" UNIQUE ("itemTransacaoAgrupadoId"), CONSTRAINT "PK_DetalheAConf_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "detalhe_b_conf" ("id" SERIAL NOT NULL, "nsr" integer NOT NULL, "dataVencimento" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "detalheAId" integer, CONSTRAINT "REL_ed5fc663251f22dd7bb9bd9c18" UNIQUE ("detalheAId"), CONSTRAINT "PK_DetalheBConf_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "file" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);
        // await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_User_photo_ManyToOne" FOREIGN KEY ("photoId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_arquivo_conf" ADD CONSTRAINT "FK_HeaderArquivoConf_transacao_ManyToOne" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_arquivo_conf" ADD CONSTRAINT "FK_HeaderArquivoConf_transacaoAgrupado_ManyToOne" FOREIGN KEY ("transacaoAgrupadoId") REFERENCES "transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_lote_conf" ADD CONSTRAINT "FK_HeaderLoteConf_headerArquivo_ManyToOne" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo_conf"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_lote_conf" ADD CONSTRAINT "FK_HeaderLoteConf_pagador_ManyToOne" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a_conf" ADD CONSTRAINT "FK_DetalheAConf_headerLote_ManyToOne" FOREIGN KEY ("headerLoteId") REFERENCES "header_lote_conf"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a_conf" ADD CONSTRAINT "FK_DetalheAConf_clienteFavorecido_ManyToOne" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a_conf" ADD CONSTRAINT "FK_DetalheAConf_itemTransacaoAgrupado_OneToOne" FOREIGN KEY ("itemTransacaoAgrupadoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_b_conf" ADD CONSTRAINT "FK_DetalheBConf_detalheA_OneToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a_conf"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_b_conf" DROP CONSTRAINT "FK_DetalheBConf_detalheA_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a_conf" DROP CONSTRAINT "FK_DetalheAConf_itemTransacaoAgrupado_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a_conf" DROP CONSTRAINT "FK_DetalheAConf_clienteFavorecido_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a_conf" DROP CONSTRAINT "FK_DetalheAConf_headerLote_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_lote_conf" DROP CONSTRAINT "FK_HeaderLoteConf_pagador_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_lote_conf" DROP CONSTRAINT "FK_HeaderLoteConf_headerArquivo_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo_conf" DROP CONSTRAINT "FK_HeaderArquivoConf_transacaoAgrupado_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo_conf" DROP CONSTRAINT "FK_HeaderArquivoConf_transacao_ManyToOne"`);
        // await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_User_photo_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "file" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`DROP TABLE "detalhe_b_conf"`);
        await queryRunner.query(`DROP TABLE "detalhe_a_conf"`);
        await queryRunner.query(`DROP TABLE "header_lote_conf"`);
        await queryRunner.query(`DROP TABLE "header_arquivo_conf"`);
    }

}
