import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice em ordem_pagamento_guardador."ordemPagamentoAgrupadoId".
 *
 * A coluna é filtrada/juntada pelos relatórios de guardadores (consolidado e movimentação financeira) e pelas
 * procedures de pendentes (x_reg/x_nunca em queries/regras-pendencia.ts, "ordens do agrupamento"). Sem índice, cada
 * verificação "ordens deste agrupamento" lia a tabela inteira (seq scan por agrupamento candidato).
 *
 * A tabela é pequena hoje (cerca de 4 mil linhas no banco de teste), então um CREATE INDEX comum leva milissegundos
 * e o lock de escrita é irrelevante. Se na produção ela já for grande, crie antes com CONCURRENTLY fora do horário de
 * pico (o IF NOT EXISTS faz este "up" virar no-op):
 *
 *   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opg_agrupado
 *     ON ordem_pagamento_guardador ("ordemPagamentoAgrupadoId");
 */
export class AddIndexOrdemPagamentoGuardadorAgrupado1791900000000 implements MigrationInterface {
  name = 'AddIndexOrdemPagamentoGuardadorAgrupado1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_opg_agrupado
      ON ordem_pagamento_guardador ("ordemPagamentoAgrupadoId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_opg_agrupado`);
  }
}
