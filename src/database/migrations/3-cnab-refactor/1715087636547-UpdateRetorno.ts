import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRetorno1715087636547 implements MigrationInterface {
    name = 'UpdateRetorno1715087636547'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ocorrencia" DROP CONSTRAINT "FK_TransacaoOcorrencia_headerArquivo_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" RENAME COLUMN "headerArquivoId" TO "headerLoteId"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "ocorrencias"`);
        await queryRunner.query(`ALTER TABLE "header_lote" ADD "ocorrenciasCnab" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "ocorrenciasCnab" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "itemTransacaoAgrupadoId" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "UQ_DetalheA_itemTransacaoAgrupado" UNIQUE ("itemTransacaoAgrupadoId")`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "itemTransacaoId" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "UQ_DetalheA_itemTransacao" UNIQUE ("itemTransacaoId")`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" ADD CONSTRAINT "FK_TransacaoOcorrencia_headerLote_ManyToOne" FOREIGN KEY ("headerLoteId") REFERENCES "header_lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne" FOREIGN KEY ("itemTransacaoAgrupadoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_itemTransacao_OneToOne" FOREIGN KEY ("itemTransacaoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_itemTransacao_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_itemTransacaoAgrupado_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" DROP CONSTRAINT "FK_TransacaoOcorrencia_headerLote_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "UQ_DetalheA_itemTransacao"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "itemTransacaoId"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "UQ_DetalheA_itemTransacaoAgrupado"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "itemTransacaoAgrupadoId"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "ocorrenciasCnab"`);
        await queryRunner.query(`ALTER TABLE "header_lote" DROP COLUMN "ocorrenciasCnab"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "ocorrencias" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" RENAME COLUMN "headerLoteId" TO "headerArquivoId"`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" ADD CONSTRAINT "FK_TransacaoOcorrencia_headerArquivo_ManyToOne" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
}
