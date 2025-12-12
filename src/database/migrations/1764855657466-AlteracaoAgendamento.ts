import { MigrationInterface, QueryRunner } from "typeorm";

export class AlteracaoAgendamento1764855657466 implements MigrationInterface {
    name = 'AlteracaoAgendamento1764855657466'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."i_ordem_pagamento_agrupado"`);
        await queryRunner.query(`DROP INDEX "public"."idx_user_id_ordem_pagamento"`);
        await queryRunner.query(`DROP INDEX "public"."nomeConsorcioIdx"`);
        await queryRunner.query(`DROP INDEX "public"."dataPagamento_idx"`);
        await queryRunner.query(`DROP INDEX "public"."idx_historico_data_referencia_id_agrupado"`);
        await queryRunner.query(`DROP INDEX "public"."statusRemessa_idx"`);
        await queryRunner.query(`DROP INDEX "public"."detalhe_a_dataVencimento_ordemPagamentoHistoricoId"`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transacao_bigquery" ("id_transacao" character varying(100) NOT NULL, "data" date, "datetime_transacao" TIMESTAMP, "consorcio" character varying, "valor_pagamento" numeric(13,5) NOT NULL, "id_ordem_pagamento" character varying, "id_ordem_pagamento_consorcio_operador_dia" character varying, "tipo_transacao" character varying, "datetime_ultima_atualizacao" TIMESTAMP, CONSTRAINT "PK_84b632b4274a2dac3a01ee7b5a6" PRIMARY KEY ("id_transacao"))`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD "diaInicioPagar" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD "diaFinalPagar" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD "diaIntervalo" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "updatedAt" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "bloqueado" DROP DEFAULT`);        
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP CONSTRAINT "FK_AprovacaoPagamento_ManyToOne"`);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "aprovacao_pagamento_id_seq" OWNED BY "aprovacao_pagamento"."id"`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ALTER COLUMN "id" SET DEFAULT nextval('"aprovacao_pagamento_id_seq"')`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ALTER COLUMN "valorGerado" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ALTER COLUMN "valorAprovado" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ALTER COLUMN "dataAprovacao" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE IF NOT EXISTS "public"."aprovacao_pagamento_status_enum" AS ENUM('0', '1', '2')`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ADD "status" "public"."aprovacao_pagamento_status_enum" NOT NULL DEFAULT '1'`);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "agendamento_pagamento_id_seq" OWNED BY "agendamento_pagamento"."id"`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ALTER COLUMN "id" SET DEFAULT nextval('"agendamento_pagamento_id_seq"')`);                        
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD CONSTRAINT "FK_AprovacaoPagamento_ManyToOne" FOREIGN KEY ("aprovacaoPagamentoId") REFERENCES "aprovacao_pagamento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP CONSTRAINT "FK_AprovacaoPagamento_ManyToOne"`);        
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`DROP SEQUENCE "agendamento_pagamento_id_seq"`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."aprovacao_pagamento_status_enum"`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ADD "status" character varying`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ALTER COLUMN "dataAprovacao" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ALTER COLUMN "valorAprovado" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ALTER COLUMN "valorGerado" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`DROP SEQUENCE "aprovacao_pagamento_id_seq"`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD CONSTRAINT "FK_AprovacaoPagamento_ManyToOne" FOREIGN KEY ("aprovacaoPagamentoId") REFERENCES "aprovacao_pagamento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);                
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "bloqueado" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "updatedAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP COLUMN "diaIntervalo"`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP COLUMN "diaFinalPagar"`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP COLUMN "diaInicioPagar"`);
        await queryRunner.query(`DROP TABLE "transacao_bigquery"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "detalhe_a_dataVencimento_ordemPagamentoHistoricoId" ON "detalhe_a" ("dataVencimento", "ordemPagamentoAgrupadoHistoricoId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS statusRemessa_idx" ON "ordem_pagamento_agrupado_historico" ("statusRemessa") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_historico_data_referencia_id_agrupado" ON "ordem_pagamento_agrupado_historico" ("dataReferencia", "ordemPagamentoAgrupadoId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "dataPagamento_idx" ON "ordem_pagamento_agrupado" ("dataPagamento") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "nomeConsorcioIdx" ON "ordem_pagamento" ("nomeConsorcio") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_id_ordem_pagamento" ON "ordem_pagamento" ("userId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "i_ordem_pagamento_agrupado" ON "ordem_pagamento" ("ordemPagamentoAgrupadoId") `);
    }

}
