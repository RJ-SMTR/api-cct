import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice parcial em ordem_pagamento."ordemPagamentoAgrupadoGratuidadeId". Hoje só poucas ordens têm
 * esse vínculo; sem o índice, qualquer busca "ordens deste agrupado de gratuidade" varre a tabela
 * inteira (~1 milhão de linhas). Usado pelo dashboard de pagamentos (conta CETT) e pelo detalhe
 * da remessa de gratuidade.
 */
export class AddIndexGratuidadeIdOrdemPagamento1791200000000 implements MigrationInterface {
  name = 'AddIndexGratuidadeIdOrdemPagamento1791200000000';
  // CREATE INDEX CONCURRENTLY não pode rodar dentro de transação; evita travar escritas em ordem_pagamento.
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_op_agrupado_gratuidade"
      ON "ordem_pagamento" ("ordemPagamentoAgrupadoGratuidadeId")
      WHERE "ordemPagamentoAgrupadoGratuidadeId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_op_agrupado_gratuidade"`);
  }
}
