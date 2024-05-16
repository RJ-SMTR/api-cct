import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveHeaderArquivoStatus1715882993008 implements MigrationInterface {
    name = 'RemoveHeaderArquivoStatus1715882993008'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_ItemTransacao_detalheA_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP CONSTRAINT "FK_HeaderArquivo_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP COLUMN "dataLancamento"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "dataLancamento"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "UQ_ItemTransacao_detalheA"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "detalheAId"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "itemTransacaoAgrupadoId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_ItemTransacao_itemTransacaoAgrupado_ManyToOne" FOREIGN KEY ("itemTransacaoAgrupadoId") REFERENCES "item_transacao_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_ItemTransacao_itemTransacaoAgrupado_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "itemTransacaoAgrupadoId"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "statusId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "detalheAId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "UQ_ItemTransacao_detalheA" UNIQUE ("detalheAId")`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "dataLancamento" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD "dataLancamento" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD CONSTRAINT "FK_HeaderArquivo_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "header_arquivo_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_ItemTransacao_detalheA_OneToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
