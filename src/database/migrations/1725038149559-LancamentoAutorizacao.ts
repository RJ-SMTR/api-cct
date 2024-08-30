import { MigrationInterface, QueryRunner } from "typeorm";

export class LancamentoAutorizacao1725038149559 implements MigrationInterface {
    name = 'LancamentoAutorizacao1725038149559'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" RENAME COLUMN "autorizado_por" TO "is_autorizado"`);
        await queryRunner.query(`CREATE TABLE "lancamento_autorizacao" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lancamentoId" integer, "userId" integer, CONSTRAINT "PK_LancamentoAutorizacao_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_LancamentoAutorizacao_lancamento" ON "lancamento_autorizacao" ("lancamentoId") `);
        await queryRunner.query(`CREATE INDEX "IDX_LancamentoAutorizacao_user" ON "lancamento_autorizacao" ("userId") `);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "is_autorizado"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "is_autorizado" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "lancamento_autorizacao" ADD CONSTRAINT "FK_LancamentoAutorizacao_lancamento" FOREIGN KEY ("lancamentoId") REFERENCES "lancamento"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "lancamento_autorizacao" ADD CONSTRAINT "FK_LancamentoAutorizacao_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento_autorizacao" DROP CONSTRAINT "FK_LancamentoAutorizacao_user"`);
        await queryRunner.query(`ALTER TABLE "lancamento_autorizacao" DROP CONSTRAINT "FK_LancamentoAutorizacao_lancamento"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "is_autorizado"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "is_autorizado" character varying`);
        await queryRunner.query(`DROP INDEX "public"."IDX_LancamentoAutorizacao_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_LancamentoAutorizacao_lancamento"`);
        await queryRunner.query(`DROP TABLE "lancamento_autorizacao"`);
        await queryRunner.query(`ALTER TABLE "lancamento" RENAME COLUMN "is_autorizado" TO "autorizado_por"`);
    }

}
