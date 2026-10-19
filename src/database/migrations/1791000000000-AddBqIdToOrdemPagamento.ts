import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ordem_pagamento.id era o id_ordem_pagamento_consorcio_operador_dia do BigQuery e o
 * sincronismo fazia `findOneBy({ id }) -> se existir, ignora`. Em 2026-10-09 cerca de 296
 * ordens novas do dia caíram em ids já ocupados por ordens antigas (reimportadas em
 * 2026-09-04) e foram descartadas em silêncio.
 *
 * Passa a existir uma coluna própria "bqId" (id do BigQuery) e o `id` vira um serial local.
 * Ordens existentes mantêm bqId = id, exceto as reimportadas em 2026-09-04 17:00-18:30
 * (dataOrdem < 2025-03-01), cujo id nunca foi o id delas no BigQuery: ficam com bqId NULL.
 */
export class AddBqIdToOrdemPagamento1791000000000 implements MigrationInterface {
  name = 'AddBqIdToOrdemPagamento1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordem_pagamento" ADD COLUMN IF NOT EXISTS "bqId" integer`);
    await queryRunner.query(`
      UPDATE "ordem_pagamento" SET "bqId" = "id"
      WHERE "bqId" IS NULL
        AND NOT ("createdAt" >= '2026-09-04 17:00' AND "createdAt" < '2026-09-04 18:30' AND "dataOrdem" < '2025-03-01')
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_OrdemPagamento_bqId" ON "ordem_pagamento" ("bqId") WHERE "bqId" IS NOT NULL`);

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "ordem_pagamento_id_seq" OWNED BY "ordem_pagamento"."id"`);
    await queryRunner.query(`SELECT setval('ordem_pagamento_id_seq', (SELECT COALESCE(MAX("id"), 0) + 1 FROM "ordem_pagamento"), false)`);
    await queryRunner.query(`ALTER TABLE "ordem_pagamento" ALTER COLUMN "id" SET DEFAULT nextval('ordem_pagamento_id_seq')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordem_pagamento" ALTER COLUMN "id" DROP DEFAULT`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "ordem_pagamento_id_seq"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_OrdemPagamento_bqId"`);
    await queryRunner.query(`ALTER TABLE "ordem_pagamento" DROP COLUMN IF EXISTS "bqId"`);
  }
}
