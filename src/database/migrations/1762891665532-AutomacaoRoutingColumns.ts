import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomacaoRoutingColumns1762891665532 implements MigrationInterface {
  name = 'AutomacaoRoutingColumns1762891665532';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD COLUMN IF NOT EXISTS "nomeConsorcio" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ADD COLUMN IF NOT EXISTS "nomeConsorcio" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ADD COLUMN IF NOT EXISTS "beneficiarioUserId" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" DROP COLUMN IF EXISTS "beneficiarioUserId"`);
    await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" DROP COLUMN IF EXISTS "nomeConsorcio"`);
    await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP COLUMN IF EXISTS "nomeConsorcio"`);
  }
}
