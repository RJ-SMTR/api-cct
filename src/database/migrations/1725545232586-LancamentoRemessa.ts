import { MigrationInterface, QueryRunner } from "typeorm";

export class LancamentoRemessa1725545232586 implements MigrationInterface {
    name = 'LancamentoRemessa1725545232586'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_Lancamento_transacao_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento" RENAME COLUMN "transacaoId" TO "itemTransacaoId"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "UQ_Lancamento_itemTransacao" UNIQUE ("itemTransacaoId")`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_Lancamento_itemTransacao_OneToOne" FOREIGN KEY ("itemTransacaoId") REFERENCES "item_transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_Lancamento_itemTransacao_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "UQ_Lancamento_itemTransacao"`);
        await queryRunner.query(`ALTER TABLE "lancamento" RENAME COLUMN "itemTransacaoId" TO "transacaoId"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_Lancamento_transacao_ManyToOne" FOREIGN KEY ("transacaoId") REFERENCES "transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
