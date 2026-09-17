import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Índices validados com EXPLAIN (ANALYZE, BUFFERS) contra dado real, cobrindo:
 * - as procedures de agrupamento pendente (p_agrupar_ordens_consorcio_pendentes,
 *   p_agrupar_ordens_guardador_pendente): idx_oph_pendente e idx_op_user_grupo;
 * - os relatórios de movimentação/consolidado (fromQueryApagar): idx_op_datacaptura.
 *
 * ATENÇÃO ao aplicar em produção: ordem_pagamento e ordem_pagamento_agrupado_historico
 * são tabelas grandes (centenas de milhares de linhas) e essas migrations rodam dentro
 * de transação por padrão, então "CREATE INDEX CONCURRENTLY" não pode ser usado aqui
 * (Postgres não permite CONCURRENTLY dentro de transação). Um CREATE INDEX comum trava
 * escrita na tabela pelo tempo do build. Recomendado: criar os três índices manualmente
 * com CONCURRENTLY fora de uma janela de pico antes de rodar esta migration — o
 * "IF NOT EXISTS" faz o "up" virar no-op nesse caso.
 */
export class AddIndexesRemessaAgrupamento1789522300000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_oph_pendente
            ON ordem_pagamento_agrupado_historico ("ordemPagamentoAgrupadoId")
            WHERE "statusRemessa" NOT IN (3,5) AND "motivoStatusRemessa" NOT IN ('AM','00','BD');
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_op_user_grupo
            ON ordem_pagamento ("userId", "ordemPagamentoAgrupadoId");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_op_datacaptura
            ON ordem_pagamento ("dataCaptura");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_op_datacaptura;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_op_user_grupo;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_oph_pendente;`);
    }

}
