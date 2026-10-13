import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Acrescenta "userId" em ordem_pagamento_agrupado_historico, referenciando public.user(id).
 *
 * A coluna é nula nas linhas existentes (adicionar uma coluna nula sem default é instantâneo e a
 * FK só valida nulos). Nenhum preenchimento retroativo é feito aqui.
 */
export class AddUserIdToOrdemPagamentoAgrupadoHistorico1791100000000 implements MigrationInterface {
  name = 'AddUserIdToOrdemPagamentoAgrupadoHistorico1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado_historico" ADD COLUMN IF NOT EXISTS "userId" integer`);
    await queryRunner.query(`
      ALTER TABLE "ordem_pagamento_agrupado_historico"
      ADD CONSTRAINT "FK_OrdemPagamentoAgrupadoHistorico_user_ManyToOne"
      FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado_historico" DROP CONSTRAINT IF EXISTS "FK_OrdemPagamentoAgrupadoHistorico_user_ManyToOne"`);
    await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado_historico" DROP COLUMN IF EXISTS "userId"`);
  }
}
