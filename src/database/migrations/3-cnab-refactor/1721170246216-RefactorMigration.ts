import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorMigration1721170246216 implements MigrationInterface {
    name = 'RefactorMigration1721170246216'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP CONSTRAINT "FK_ItemTransacaoAgrupado_clienteFavorecido_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP CONSTRAINT "FK_HeaderArquivo_transacao_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP CONSTRAINT "FK_DetalheA_clienteFavorecido_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP COLUMN "clienteFavorecidoId"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "transacaoId"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" DROP COLUMN "clienteFavorecidoId"`);
        await queryRunner.query(`ALTER TABLE "transacao_view" ALTER COLUMN "modo" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" ALTER COLUMN "modo" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD "clienteFavorecidoId" integer`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "transacaoId" integer`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD "clienteFavorecidoId" integer`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ADD CONSTRAINT "FK_DetalheA_clienteFavorecido_ManyToOne" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD CONSTRAINT "FK_HeaderArquivo_transacao_ManyToOne" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD CONSTRAINT "FK_ItemTransacaoAgrupado_clienteFavorecido_ManyToOne" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
