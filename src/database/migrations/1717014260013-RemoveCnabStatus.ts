import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveCnabStatus1717014260013 implements MigrationInterface {
    name = 'RemoveCnabStatus1717014260013'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP CONSTRAINT "FK_ItemTransacaoAgrupado_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP CONSTRAINT "FK_ItemTransacao_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP CONSTRAINT "FK_Transacao_status_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "transacao" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "glosa"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "glosa" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "recurso"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "recurso" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "anexo"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "anexo" numeric NOT NULL`);
        await queryRunner.query(`DROP TABLE "item_transacao_status"`); // No down command
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "anexo"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "anexo" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "recurso"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "recurso" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "glosa"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "glosa" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD "statusId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "statusId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD "statusId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transacao" ADD CONSTRAINT "FK_Transacao_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "transacao_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD CONSTRAINT "FK_ItemTransacao_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "item_transacao_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_transacao_agrupado" ADD CONSTRAINT "FK_ItemTransacaoAgrupado_status_ManyToOne" FOREIGN KEY ("statusId") REFERENCES "item_transacao_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
