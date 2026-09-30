import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateDetalheAValorLancamentoAuditoria1790200000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS detalhe_a_valor_lancamento_auditoria (
                id SERIAL PRIMARY KEY,
                "detalheAId" INTEGER NOT NULL,
                "userId" INTEGER NOT NULL,
                "valorAnterior" NUMERIC(13,2) NOT NULL,
                "valorNovo" NUMERIC(13,2) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "FK_DetalheAValorLancamentoAuditoria_detalheA_ManyToOne" FOREIGN KEY ("detalheAId") REFERENCES detalhe_a(id),
                CONSTRAINT "FK_DetalheAValorLancamentoAuditoria_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"(id)
            );
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_detalhe_a_valor_lancamento_auditoria_detalhe_a
            ON detalhe_a_valor_lancamento_auditoria ("detalheAId");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_detalhe_a_valor_lancamento_auditoria_detalhe_a;`);
        await queryRunner.query(`DROP TABLE IF EXISTS detalhe_a_valor_lancamento_auditoria;`);
    }

}
