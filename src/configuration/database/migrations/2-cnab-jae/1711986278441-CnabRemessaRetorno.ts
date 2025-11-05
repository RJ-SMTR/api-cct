import { MigrationInterface, QueryRunner } from "typeorm";

export class CnabRemessaRetorno1711986278441 implements MigrationInterface {
    name = 'CnabRemessaRetorno1711986278441'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_User_socialId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_User_firstName"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_User_lastName"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_User_fullName"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_User_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_Forgot_hash"`);
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "UQ_Setting_name_version"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "tipoFinalidadeConta"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "numeroDocumentoLancamento"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "finalidadeDOC" character varying`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "numeroDocumentoEmpresa" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "numeroDocumentoBanco" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "tipoArquivo"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "tipoArquivo" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "loteServico"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "loteServico" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_Invite_inviteStatus_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "invite_status" DROP CONSTRAINT "UQ_InviteStatus_id"`);
        await queryRunner.query(`ALTER TABLE "invite_status" ADD CONSTRAINT "UQ_InviteStatus_id" UNIQUE ("name")`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "loteServico"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "loteServico" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "quantidadeParcelas"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "quantidadeParcelas" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "numeroParcela"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "numeroParcela" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_User_socialId" ON "user" ("socialId") `);
        await queryRunner.query(`CREATE INDEX "IDX_User_firstName" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_User_lastName" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_User_fullName" ON "user" ("fullName") `);
        await queryRunner.query(`CREATE INDEX "IDX_User_hash" ON "user" ("hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_Forgot_hash" ON "forgot" ("hash") `);
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "UQ_Setting_name_version" UNIQUE ("name", "version")`);
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "FK_Invite_inviteStatus_ManyToOne" FOREIGN KEY ("inviteStatusId") REFERENCES "invite_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_Invite_inviteStatus_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "UQ_Setting_name_version"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_User_socialId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_User_firstName"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_User_lastName"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_User_fullName"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_User_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_Forgot_hash"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "numeroParcela"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "numeroParcela" character varying`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "quantidadeParcelas"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "quantidadeParcelas" character varying`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "loteServico"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "loteServico" character varying`);
        await queryRunner.query(`ALTER TABLE "invite_status" DROP CONSTRAINT "UQ_InviteStatus_id"`);
        await queryRunner.query(`ALTER TABLE "invite_status" ADD CONSTRAINT "UQ_InviteStatus_id" UNIQUE ("id")`);
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "FK_Invite_inviteStatus_ManyToOne" FOREIGN KEY ("inviteStatusId") REFERENCES "invite_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "loteServico"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "loteServico" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "tipoArquivo"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "tipoArquivo" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "numeroDocumentoBanco"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "numeroDocumentoEmpresa"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "finalidadeDOC"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "numeroDocumentoLancamento" character varying`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "tipoFinalidadeConta" character varying`);
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "UQ_Setting_name_version" UNIQUE ("name", "version")`);
        await queryRunner.query(`CREATE INDEX "IDX_Forgot_hash" ON "forgot" ("hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_User_hash" ON "user" ("hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_User_fullName" ON "user" ("fullName") `);
        await queryRunner.query(`CREATE INDEX "IDX_User_lastName" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_User_firstName" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_User_socialId" ON "user" ("socialId") `);
    }

}
