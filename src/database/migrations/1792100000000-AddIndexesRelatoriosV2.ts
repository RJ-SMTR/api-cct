import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices dos relatórios v2 (ADR 0023, T7), escolhidos pelo EXPLAIN ANALYZE em homologação (12/11/2026,
 * Consolidado de todos os favorecidos):
 *
 * - idx_opa_agrupamento_pai: a regra "agrupamento sem filhas" (NOT EXISTS ... filha."ordemPagamentoAgrupadoId" = opa.id)
 *   virava um Nested Loop Anti Join que lia ordem_pagamento_agrupado inteira (~355 mil linhas) para cada linha de
 *   fora: 4,4 s dos 8,5 s em 3 meses, e crescimento quadrático com o período (1 ano passava de 3 min). Parcial: só
 *   as filhas têm o pai preenchido.
 * - idx_*_date: os filtros de período usam col::date (ADR 0005, as colunas são timestamp gravadas às 03:00). Sem
 *   índice na expressão, o Postgres faz seq scan e não tem estatística dela: estimava 1.682 linhas de detalhe_a
 *   em 3 meses quando vinham 71.308, e escolhia planos de nested loop por isso.
 *
 * Já existiam em homologação e ficam de fora: detalhe_a("ordemPagamentoAgrupadoHistoricoId") e
 * ordem_pagamento_agrupado_historico("ordemPagamentoAgrupadoId", ...).
 */
export class AddIndexesRelatoriosV21792100000000 implements MigrationInterface {
  name = 'AddIndexesRelatoriosV21792100000000';
  // CREATE INDEX CONCURRENTLY não pode rodar dentro de transação; evita travar escritas nas tabelas de pagamento
  // (remessa e retorno) durante o deploy.
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_opa_agrupamento_pai"
      ON "ordem_pagamento_agrupado" ("ordemPagamentoAgrupadoId")
      WHERE "ordemPagamentoAgrupadoId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_detalhe_a_data_vencimento_date"
      ON "detalhe_a" ((("dataVencimento")::date))
    `);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_opa_data_pagamento_date"
      ON "ordem_pagamento_agrupado" ((("dataPagamento")::date))
    `);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_op_data_captura_date"
      ON "ordem_pagamento" ((("dataCaptura")::date))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_op_data_captura_date"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_opa_data_pagamento_date"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_detalhe_a_data_vencimento_date"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "idx_opa_agrupamento_pai"`);
  }
}
