import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeekdaysToAgendamento1767000000000 implements MigrationInterface {
  name = 'AddWeekdaysToAgendamento1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "agendamento_pagamento" ADD "weekdays" integer array');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "agendamento_pagamento" DROP COLUMN "weekdays"');
  }
}
