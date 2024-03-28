import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCnabExtrato1711492329959 implements MigrationInterface {
    name = 'CreateCnabExtrato1711492329959'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mail_count" DROP CONSTRAINT "PK_0d21bf669f46d5df78f6b7004e9"`); // custom
        await queryRunner.query(`ALTER TABLE "mail_count" ADD CONSTRAINT "PK_MailCount_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "PK_133f2e1e4c9e3e9f2f6b1b0b345"`); // custom
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "PK_Lancamento_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "PK_22de2aadff9e230e92bc4cb1ef6"`); // custom
        await queryRunner.query(`ALTER TABLE "bank" DROP CONSTRAINT "PK_7651eaf705126155142947926e8"`); // custom
        await queryRunner.query(`ALTER TABLE "bank" ADD CONSTRAINT "PK_Bank_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "bank" DROP CONSTRAINT "UQ_644e44c1a3cb9d4b431fb080160"`); // custom
        await queryRunner.query(`ALTER TABLE "bank" ADD CONSTRAINT "UQ_Bank_ispb" UNIQUE ("ispb")`); // custom
        await queryRunner.query(`ALTER TABLE "bank" DROP CONSTRAINT "UQ_efdd3f589f04cd21d79136de1aa"`); // custom
        await queryRunner.query(`ALTER TABLE "bank" ADD CONSTRAINT "UQ_Bank_code" UNIQUE ("code")`); // custom
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "PK_0ece5ad3a5dc48173e507af0639"`); // custom
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "PK_DetalheA_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "forgot" DROP CONSTRAINT "PK_087959f5bb89da4ce3d763eab75"`); // custom
        await queryRunner.query(`ALTER TABLE "forgot" ADD CONSTRAINT "PK_Forgot_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER INDEX "IDX_df507d27b0fb20cd5f7bef9b9a" RENAME TO "IDX_Forgot_hash"`); // custom
        await queryRunner.query(`ALTER TABLE "info" DROP CONSTRAINT "PK_687dc5e25f4f1ee093a45b68bb7"`); // custom
        await queryRunner.query(`ALTER TABLE "info" ADD CONSTRAINT "PK_Info_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "info" DROP CONSTRAINT "UQ_916df6cf672c24f99ceab946a88"`); // custom
        await queryRunner.query(`ALTER TABLE "info" ADD CONSTRAINT "UQ_Info_name" UNIQUE ("name")`); // custom
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "PK_fc9fa190e5a3c5d80604a4f63e1"`); // custom
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "PK_Invite_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "UQ_dbcbf85f7e3e27d864631d1cf14"`); // custom
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "UQ_Invite_hash" UNIQUE ("hash")`); // custom
        await queryRunner.query(`ALTER TABLE "mail_count" DROP CONSTRAINT "UQ_426e0538ee56b8771e2cc5fee07"`); // custom
        await queryRunner.query(`ALTER TABLE "mail_count" ADD CONSTRAINT "UQ_MailCount_email" UNIQUE ("email")`); // custom
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_dc18daa696860586ba4667a9d31"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_75e2be4ce11d447ef43be0e374f"`);
        await queryRunner.query(`ALTER TABLE "status" DROP CONSTRAINT "PK_e12743a7086ec826733f54e1d95"`); // custom
        await queryRunner.query(`ALTER TABLE "status" ADD CONSTRAINT "PK_Status_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2"`); // custom
        await queryRunner.query(`ALTER TABLE "role" ADD CONSTRAINT "PK_Role_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "file" DROP CONSTRAINT "PK_36b46d232307066b3a2c9ea3a1d"`); // custom
        await queryRunner.query(`ALTER TABLE "file" ADD CONSTRAINT "PK_File_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "FK_9034ea1202b6574b75a2304d419"`); // edited
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_ea066846cf244204c813b72ff50"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_80f6744ced95ab9e8dd0b212fee"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "FK_097c8d865615a7ec0516929b65f"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP CONSTRAINT "FK_2ecc2606a7de054a63c0e22f206"`);
        await queryRunner.query(`ALTER TABLE "forgot" DROP CONSTRAINT "FK_31f3c80de0525250f31e23a9b83"`);
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_118ec7f671543d9b992512e7cb9"`);
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_91bfeec7a9574f458e5b592472d"`);
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "FK_a5bc5fbecc0b218be61ef25b725"`);
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "PK_fcb21187dc6094e24a48f677bed"`); // custom
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "PK_Setting_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "UQ_91a4f31e402dfa1da9b200ef924"`); // custom
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "UQ_Setting_name_version" UNIQUE ("name", "version")`); // custom
        await queryRunner.query(`ALTER TABLE "setting_type" DROP CONSTRAINT "PK_e423059281ed2740a3de81bd149"`); // custom
        await queryRunner.query(`ALTER TABLE "setting_type" ADD CONSTRAINT "PK_SettingType_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "setting_type" DROP CONSTRAINT "UQ_a4b944907a7b757fc5a4f91ba5e"`); // custom
        await queryRunner.query(`ALTER TABLE "setting_type" ADD CONSTRAINT "UQ_SettingType_name" UNIQUE ("name")`); // custom
        await queryRunner.query(`ALTER TABLE "header_lote" DROP CONSTRAINT "FK_75f6c2ed71c10935915157b45f9"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP CONSTRAINT "FK_cd9a79df522dbe1b057230614e9"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP CONSTRAINT "PK_d7a8097c7ff853f854e14b3ecc8"`); // custom
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_b5a7c03d9250881766627229e5d"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_7228a16907c82f80e733dcb465b"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP CONSTRAINT "PK_9270a7bf4ac64c659baa292cdca"`); // custom
        await queryRunner.query(`ALTER TABLE "pagador" DROP CONSTRAINT "PK_f4f2b9f707df275194545243890"`); // custom
        await queryRunner.query(`ALTER TABLE "pagador" ADD CONSTRAINT "PK_Pagador_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_67142ca27ead7b1bccbbc968c4b"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_04f9231ba148125f267dd160196"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "PK_1fba4427ea668b5fd4851ce6a01"`); // custom
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "PK_8a60051729f5d7e2d49c8fa91c5"`); // custom
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "PK_Transacao_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "PK_fde4dc0b210ba36375b2adf9537"`); // custom
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "PK_cace4a159ff9f2512dd42373760"`); // custom
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "PK_User_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22"`); // custom
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_User_email" UNIQUE ("email")`); // custom
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "PK_ClienteFavorecido_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`CREATE TABLE "permissionario_role" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_PermissionarioRole_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "header_arquivo_status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_HeaderArquivoStatus_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "transacao_status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_TransacaoStatus_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "extrato_header_arquivo" ("id" SERIAL NOT NULL, "tipoArquivo" integer, "codigoBanco" character varying(10), "tipoInscricao" character varying(2), "numeroInscricao" character varying(14), "codigoConvenio" character varying(6), "parametroTransmissao" character varying(2), "agencia" character varying(5), "dvAgencia" character varying(1), "numeroConta" character varying(12), "dvConta" character varying(1), "nomeEmpresa" character varying(100), "dataGeracao" TIMESTAMP, "horaGeracao" TIME, "nsa" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ExtratoHeaderArquivo_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "extrato_header_lote" ("id" SERIAL NOT NULL, "loteServico" integer, "tipoInscricao" character varying, "numeroInscricao" character varying, "codigoConvenioBanco" character varying, "dataSaldoInicial" TIMESTAMP NOT NULL, "valorSaldoInicial" numeric(16,2) NOT NULL, "situacaoSaldoInicial" character varying(1) NOT NULL, "posicaoSaldoInicial" character varying(1) NOT NULL, "tipoMoeda" character varying(3) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "extratoHeaderArquivoId" integer, CONSTRAINT "PK_ExtratoHeaderLote_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "extrato_detalhe_e" ("id" SERIAL NOT NULL, "loteServico" integer NOT NULL, "nsr" integer NOT NULL, "tipoInscricao" character varying NOT NULL, "numeroInscricao" character varying NOT NULL, "codigoConvenioBanco" character varying NOT NULL, "agencia" character varying NOT NULL, "dvAgencia" character varying NOT NULL, "conta" character varying NOT NULL, "dvConta" character varying NOT NULL, "dvAgenciaConta" character varying NOT NULL, "nomeEmpresa" character varying NOT NULL, "dataLancamento" TIMESTAMP NOT NULL, "valorLancamento" numeric(16,2), "tipoLancamento" character varying NOT NULL, "categoriaLancamento" character varying NOT NULL, "codigoHistoricoBanco" character varying NOT NULL, "descricaoHistoricoBanco" character varying NOT NULL, "numeroDocumento" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "extratoHeaderLoteId" integer, CONSTRAINT "PK_ExtratoDetalheE_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(/** edited */`CREATE TABLE "detalhe_b" ("id" SERIAL NOT NULL, "nsr" integer NOT NULL, "dataVencimento" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "detalheAId" integer, CONSTRAINT "REL_DetalheB_detalheA_Unique" UNIQUE ("detalheAId"), CONSTRAINT "PK_DetalheB_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "item_transacao_status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_ItemTransacaoStatusId_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dtVencimento"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "permissionarioRoleId" integer`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "permissionarioRoleId" integer`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "userId" integer`);
        await queryRunner.query(/** edited */`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "UQ_ClienteFavorecido_user" UNIQUE ("userId")`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "data_lancamento" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "idOperadora" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "idConsorcio" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "versaoOrdemPagamento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "statusId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "statusId" integer`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dataVencimento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idDetalheARetorno" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "nomeOperadora" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "favorecidoCpfCnpj" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "dataOrdem" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "versaoOrdemPagamento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "detalheAId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "UQ_ItemTransacao_detalheA" UNIQUE ("detalheAId")`); // edited
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
        await queryRunner.query(`ALTER TABLE "header_arquivo" ALTER COLUMN "tipoArquivo" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "dataGeracao"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "dataGeracao" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD CONSTRAINT "PK_HeaderArquivo_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "header_lote" DROP COLUMN "loteServico"`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD "loteServico" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "quantidadeMoeda"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "quantidadeMoeda" numeric(5,10)`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "PK_ItemTransacao_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "header_lote" ADD CONSTRAINT "PK_HeaderLote_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_User_photo_ManyToOne" FOREIGN KEY ("photoId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_User_role_ManyToOne" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_User_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_User_permissionarioRole_ManyToOne" FOREIGN KEY ("permissionarioRoleId") REFERENCES "permissionario_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "FK_ClienteFavorecido_permissionarioRole_ManyToOne" FOREIGN KEY ("permissionarioRoleId") REFERENCES "permissionario_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "FK_ClienteFavorecido_user_OneToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_Lancamento_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_Lancamento_idClienteFavorecido_ManyToOne" FOREIGN KEY ("id_cliente_favorecido") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "FK_Transacao_pagador_ManyToOne" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "FK_Transacao_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "transacao_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD CONSTRAINT "FK_HeaderArquivo_transacao_ManyToOne" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD CONSTRAINT "FK_HeaderArquivo_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "header_arquivo_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "forgot" ADD CONSTRAINT "FK_Forgot_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "FK_Invite_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "FK_Invite_inviteStatus_ManyToOne" FOREIGN KEY ("inviteStatusId") REFERENCES "invite_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "FK_Setting_settingType_ManyToOne" FOREIGN KEY ("settingTypeId") REFERENCES "setting_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "extrato_header_lote" ADD CONSTRAINT "FK_ExtratoHeaderLote_extratoHeaderArquivo_ManyToOne" FOREIGN KEY ("extratoHeaderArquivoId") REFERENCES "extrato_header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "extrato_detalhe_e" ADD CONSTRAINT "FK_ExtratoDetalheE_extratoHeaderLote_ManyToOne" FOREIGN KEY ("extratoHeaderLoteId") REFERENCES "extrato_header_lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD CONSTRAINT "FK_HeaderLote_headerArquivo_ManyToOne" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD CONSTRAINT "FK_HeaderLote_pagador_ManyToOne" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_headerLote_ManyToOne" FOREIGN KEY ("headerLoteId") REFERENCES "header_lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_clienteFavorecido_ManyToOne" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_b" ADD CONSTRAINT "FK_DetalheB_detalheA_OneToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_ItemTransacao_transacao_ManyToOne" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_ItemTransacao_clienteFavorecido_ManyToOne" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_ItemTransacao_detalheA_OneToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_ItemTransacao_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "item_transacao_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "PK_ArquivoPublicacao_id" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "FK_ArquivoPublicacao_headerArquivo_ManyToOne" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "PK_ArquivoPublicacao_id"`); // custom
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "FK_ArquivoPublicacao_headerArquivo_ManyToOne"`); // moved
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "PK_ItemTransacao_id"`); // custom
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_ItemTransacao_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_ItemTransacao_detalheA_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_ItemTransacao_clienteFavorecido_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_ItemTransacao_transacao_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_b" DROP CONSTRAINT "FK_DetalheB_detalheA_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_clienteFavorecido_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_headerLote_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP CONSTRAINT "FK_HeaderLote_pagador_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP CONSTRAINT "FK_HeaderLote_headerArquivo_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP CONSTRAINT "PK_HeaderLote_id"`); // custom
        await queryRunner.query(`ALTER TABLE "extrato_detalhe_e" DROP CONSTRAINT "FK_ExtratoDetalheE_extratoHeaderLote_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "extrato_header_lote" DROP CONSTRAINT "FK_ExtratoHeaderLote_extratoHeaderArquivo_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "FK_Setting_settingType_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "UQ_Setting_name_version"`); // custom
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "UQ_91a4f31e402dfa1da9b200ef924" UNIQUE ("name", "version")`); // custom
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "PK_Setting_id"`); // custom
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "PK_fcb21187dc6094e24a48f677bed" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "setting_type" DROP CONSTRAINT "PK_SettingType_id"`); // custom
        await queryRunner.query(`ALTER TABLE "setting_type" ADD CONSTRAINT "PK_e423059281ed2740a3de81bd149" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "setting_type" DROP CONSTRAINT "UQ_SettingType_name"`); // custom
        await queryRunner.query(`ALTER TABLE "setting_type" ADD CONSTRAINT "UQ_a4b944907a7b757fc5a4f91ba5e" UNIQUE ("name")`); // custom
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_Invite_inviteStatus_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_Invite_user_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "forgot" DROP CONSTRAINT "FK_Forgot_user_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP CONSTRAINT "FK_HeaderArquivo_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP CONSTRAINT "FK_HeaderArquivo_transacao_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP CONSTRAINT "PK_HeaderArquivo_id"`); // custom
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "PK_Transacao_id"`); // custom
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "PK_8a60051729f5d7e2d49c8fa91c5" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "FK_Transacao_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "FK_Transacao_pagador_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "pagador" DROP CONSTRAINT "PK_Pagador_id"`); // custom
        await queryRunner.query(`ALTER TABLE "pagador" ADD CONSTRAINT "PK_f4f2b9f707df275194545243890" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_Lancamento_idClienteFavorecido_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_Lancamento_user_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "FK_ClienteFavorecido_user_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "FK_ClienteFavorecido_permissionarioRole_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "PK_ClienteFavorecido_id"`); // custom
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "PK_User_id"`); // custom
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_User_email"`); // custom
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email")`); // custom
        await queryRunner.query(/** custom */`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "PK_fde4dc0b210ba36375b2adf9537" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_User_permissionarioRole_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_User_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_User_role_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_User_photo_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "status" DROP CONSTRAINT "PK_Status_id"`); // custom
        await queryRunner.query(`ALTER TABLE "status" ADD CONSTRAINT "PK_e12743a7086ec826733f54e1d95" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "PK_Role_id"`); // custom
        await queryRunner.query(`ALTER TABLE "role" ADD CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "quantidadeMoeda"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "quantidadeMoeda" integer`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP COLUMN "loteServico"`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD "loteServico" character varying`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "dataGeracao"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "dataGeracao" character varying`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ALTER COLUMN "tipoArquivo" DROP NOT NULL`);
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
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "UQ_ItemTransacao_detalheA"`); // edited
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "detalheAId"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "versaoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "dataOrdem"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "favorecidoCpfCnpj"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "nomeOperadora"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idDetalheARetorno"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dataVencimento"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "versaoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "idConsorcio"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "idOperadora"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "data_lancamento"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "UQ_ClienteFavorecido_user"`); // edited
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "permissionarioRoleId"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "permissionarioRoleId"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dtVencimento" character varying NOT NULL`);
        await queryRunner.query(`DROP TABLE "item_transacao_status"`);
        await queryRunner.query(`DROP TABLE "detalhe_b"`);
        await queryRunner.query(`DROP TABLE "extrato_detalhe_e"`);
        await queryRunner.query(`DROP TABLE "extrato_header_lote"`);
        await queryRunner.query(`DROP TABLE "extrato_header_arquivo"`);
        await queryRunner.query(`DROP TABLE "transacao_status"`);
        await queryRunner.query(`DROP TABLE "header_arquivo_status"`);
        await queryRunner.query(`DROP TABLE "permissionario_role"`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD CONSTRAINT "PK_9270a7bf4ac64c659baa292cdca" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "PK_1fba4427ea668b5fd4851ce6a01" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_04f9231ba148125f267dd160196" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_67142ca27ead7b1bccbbc968c4b" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_7228a16907c82f80e733dcb465b" FOREIGN KEY ("headerLoteId") REFERENCES "header_lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_b5a7c03d9250881766627229e5d" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "header_lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD CONSTRAINT "PK_d7a8097c7ff853f854e14b3ecc8" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "header_lote" ADD CONSTRAINT "FK_cd9a79df522dbe1b057230614e9" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD CONSTRAINT "FK_75f6c2ed71c10935915157b45f9" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "FK_a5bc5fbecc0b218be61ef25b725" FOREIGN KEY ("settingTypeId") REFERENCES "setting_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "FK_118ec7f671543d9b992512e7cb9" FOREIGN KEY ("inviteStatusId") REFERENCES "invite_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "forgot" ADD CONSTRAINT "FK_31f3c80de0525250f31e23a9b83" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "FK_9034ea1202b6574b75a2304d419" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD CONSTRAINT "FK_2ecc2606a7de054a63c0e22f206" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "FK_097c8d865615a7ec0516929b65f" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_80f6744ced95ab9e8dd0b212fee" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_ea066846cf244204c813b72ff50" FOREIGN KEY ("id_cliente_favorecido") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "file" DROP CONSTRAINT "PK_File_id"`); // custom
        await queryRunner.query(`ALTER TABLE "file" ADD CONSTRAINT "PK_36b46d232307066b3a2c9ea3a1d" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_75e2be4ce11d447ef43be0e374f" FOREIGN KEY ("photoId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_dc18daa696860586ba4667a9d31" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "UQ_Invite_hash"`); // custom
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "UQ_dbcbf85f7e3e27d864631d1cf14" UNIQUE ("hash")`); // custom
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "PK_Invite_id"`); // custom
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "PK_fc9fa190e5a3c5d80604a4f63e1" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "mail_count" DROP CONSTRAINT "UQ_MailCount_email"`); // custom
        await queryRunner.query(`ALTER TABLE "mail_count" ADD CONSTRAINT "UQ_426e0538ee56b8771e2cc5fee07" UNIQUE ("email")`); // custom
        await queryRunner.query(`ALTER TABLE "info" DROP CONSTRAINT "PK_Info_id"`); // custom
        await queryRunner.query(`ALTER TABLE "info" ADD CONSTRAINT "PK_687dc5e25f4f1ee093a45b68bb7" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "info" DROP CONSTRAINT "UQ_Info_name"`); // custom
        await queryRunner.query(`ALTER TABLE "info" ADD CONSTRAINT "UQ_916df6cf672c24f99ceab946a88" UNIQUE ("name")`); // custom
        await queryRunner.query(`ALTER INDEX "IDX_Forgot_hash" RENAME TO "IDX_df507d27b0fb20cd5f7bef9b9a"`); // custom
        await queryRunner.query(`ALTER TABLE "forgot" DROP CONSTRAINT "PK_Forgot_id"`); // custom
        await queryRunner.query(`ALTER TABLE "forgot" ADD CONSTRAINT "PK_087959f5bb89da4ce3d763eab75" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "PK_DetalheA_id"`); // custom
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "PK_0ece5ad3a5dc48173e507af0639" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "bank" DROP CONSTRAINT "UQ_Bank_code"`); // custom
        await queryRunner.query(`ALTER TABLE "bank" ADD CONSTRAINT "UQ_efdd3f589f04cd21d79136de1aa" UNIQUE ("code")`); // custom
        await queryRunner.query(`ALTER TABLE "bank" DROP CONSTRAINT "UQ_Bank_ispb"`); // custom
        await queryRunner.query(`ALTER TABLE "bank" ADD CONSTRAINT "UQ_644e44c1a3cb9d4b431fb080160" UNIQUE ("ispb")`); // custom
        await queryRunner.query(`ALTER TABLE "bank" DROP CONSTRAINT "PK_Bank_id"`); // custom
        await queryRunner.query(`ALTER TABLE "bank" ADD CONSTRAINT "PK_7651eaf705126155142947926e8" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "PK_22de2aadff9e230e92bc4cb1ef6" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "PK_Lancamento_id"`); // custom
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "PK_133f2e1e4c9e3e9f2f6b1b0b345" PRIMARY KEY ("id")`); // custom
        await queryRunner.query(`ALTER TABLE "mail_count" DROP CONSTRAINT "PK_MailCount_id"`); // custom
        await queryRunner.query(`ALTER TABLE "mail_count" ADD CONSTRAINT "PK_0d21bf669f46d5df78f6b7004e9" PRIMARY KEY ("id")`); // custom
    }

}
