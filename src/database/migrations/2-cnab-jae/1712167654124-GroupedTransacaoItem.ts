import { MigrationInterface, QueryRunner } from "typeorm";

export class GroupedTransacaoItem1712167654124 implements MigrationInterface {
    name = 'GroupedTransacaoItem1712167654124'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "transacao_ocorrencia" ("id" SERIAL NOT NULL, "code" character varying(2) NOT NULL, "message" character varying(100) NOT NULL, "transacaoId" integer, CONSTRAINT "UQ_TransacaoOcorrencia_code" UNIQUE ("code"), CONSTRAINT "PK_Ocorrencia_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "ocorrencias"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idTransacao"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "versaoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "servico"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "isPago" boolean NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idOrdemPagamento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idConsorcio" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idOperadora" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "dataOrdem" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "nomeConsorcio" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "nomeOperadora" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "valorTotalTransacaoLiquido" numeric(13,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "transacaoId" integer`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "idHeaderLote" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "dataGeracaoRemessa" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "horaGeracaoRemessa" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "dataGeracaoRetorno" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "horaGeracaoRetorno" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "dataVencimento" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "valorLancamento" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "dataEfetivacao" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "valorRealEfetivado" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "idDetalheARetorno" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao_ocorrencia" ADD CONSTRAINT "FK_TransacaoOcorrencia_transacao_ManyToOne" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD CONSTRAINT "FK_ArquivoPublicacao_transacao_ManyToOne" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP CONSTRAINT "FK_ArquivoPublicacao_transacao_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "transacao_ocorrencia" DROP CONSTRAINT "FK_TransacaoOcorrencia_transacao_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "idDetalheARetorno" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "valorRealEfetivado" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "dataEfetivacao" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "valorLancamento" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "dataVencimento" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "horaGeracaoRetorno" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "dataGeracaoRetorno" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "horaGeracaoRemessa" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "dataGeracaoRemessa" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "idHeaderLote" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "transacaoId"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "valorTotalTransacaoLiquido"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "nomeOperadora"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "nomeConsorcio"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "dataOrdem"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idOperadora"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idConsorcio"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "isPago"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "servico" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "versaoOrdemPagamento" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idTransacao" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "ocorrencias" character varying`);
        await queryRunner.query(`DROP TABLE "transacao_ocorrencia"`);
    }

}
