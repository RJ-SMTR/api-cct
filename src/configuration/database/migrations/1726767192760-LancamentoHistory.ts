import { MigrationInterface, QueryRunner } from "typeorm";

export class LancamentoHistory1726767192760 implements MigrationInterface {
    name = 'LancamentoHistory1726767192760'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "lancamento_history" ("id" SERIAL NOT NULL, "valor" numeric NOT NULL, "data_ordem" TIMESTAMP NOT NULL DEFAULT now(), "data_pgto" TIMESTAMP, "data_lancamento" TIMESTAMP NOT NULL DEFAULT now(), "algoritmo" numeric NOT NULL, "glosa" numeric NOT NULL DEFAULT '0', "recurso" numeric NOT NULL DEFAULT '0', "anexo" numeric NOT NULL DEFAULT '0', "numero_processo" character varying NOT NULL, "is_autorizado" boolean NOT NULL DEFAULT false, "is_pago" boolean NOT NULL DEFAULT false, "status" character varying NOT NULL DEFAULT 'criado', "motivo_cancelamento" character varying, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "backupAt" TIMESTAMP NOT NULL DEFAULT now(), "lancamentoId" integer NOT NULL, "itemTransacaoId" integer, "autorId" integer, "id_cliente_favorecido" integer, CONSTRAINT "REL_LancamentoHistory_itemTransacao_Unique" UNIQUE ("itemTransacaoId"), CONSTRAINT "PK_LancamentoHistory_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "lancamento_autorizacao_history" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "backupAt" TIMESTAMP NOT NULL DEFAULT now(), "lancamentoHistoryId" integer, "userId" integer, CONSTRAINT "PK_LancamentoAutorizacaoHistory_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_LancamentoAutorizacaoHistory_lancamento" ON "lancamento_autorizacao_history" ("lancamentoHistoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_LancamentoAutorizacaoHistory_user" ON "lancamento_autorizacao_history" ("userId") `);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "motivo_cancelamento" character varying`);
        await queryRunner.query(`ALTER TABLE "lancamento_history" ADD CONSTRAINT "FK_LancamentoHistory_lancamento_ManyToOne" FOREIGN KEY ("lancamentoId") REFERENCES "lancamento"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "lancamento_history" ADD CONSTRAINT "FK_LancamentoHistory_itemTransacao_OneToOne" FOREIGN KEY ("itemTransacaoId") REFERENCES "item_transacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lancamento_history" ADD CONSTRAINT "FK_LancamentoHistory_autor_ManyToOne" FOREIGN KEY ("autorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lancamento_history" ADD CONSTRAINT "FK_LancamentoHistory_idClienteFavorecido_ManyToOne" FOREIGN KEY ("id_cliente_favorecido") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lancamento_autorizacao_history" ADD CONSTRAINT "FK_LancamentoAutorizacaoHistory_lancamento" FOREIGN KEY ("lancamentoHistoryId") REFERENCES "lancamento_history"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "lancamento_autorizacao_history" ADD CONSTRAINT "FK_LancamentoAutorizacaoHistory_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento_autorizacao_history" DROP CONSTRAINT "FK_LancamentoAutorizacaoHistory_user"`);
        await queryRunner.query(`ALTER TABLE "lancamento_autorizacao_history" DROP CONSTRAINT "FK_LancamentoAutorizacaoHistory_lancamento"`);
        await queryRunner.query(`ALTER TABLE "lancamento_history" DROP CONSTRAINT "FK_LancamentoHistory_idClienteFavorecido_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento_history" DROP CONSTRAINT "FK_LancamentoHistory_autor_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento_history" DROP CONSTRAINT "FK_LancamentoHistory_itemTransacao_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento_history" DROP CONSTRAINT "FK_LancamentoHistory_lancamento_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "motivo_cancelamento"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_LancamentoAutorizacaoHistory_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_LancamentoAutorizacaoHistory_lancamento"`);
        await queryRunner.query(`DROP TABLE "lancamento_autorizacao_history"`);
        await queryRunner.query(`DROP TABLE "lancamento_history"`);
    }

}
