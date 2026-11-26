import { MigrationInterface, QueryRunner } from 'typeorm';

/** Lançamentos manuais do "Controle Remessa Erros" (Administração do Sistema). Os dados automáticos vêm das remessas. */
export class CreateControleRemessaErro1791500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists controle_remessa_erro (
        id serial primary key,
        data_geracao_remessa date not null,
        data_pagamento date,
        nome_remessa varchar(300),
        favorecido varchar(300),
        valor_pagar numeric(18,2),
        valor_pago_juizo numeric(18,2),
        valor_total_pago numeric(18,2),
        status varchar(40),
        ocorrencia text,
        criado_por integer,
        atualizado_por integer,
        created_at timestamp not null default now(),
        updated_at timestamp not null default now()
      );
    `);
    await queryRunner.query(
      `create index if not exists idx_controle_remessa_erro_data on controle_remessa_erro (data_geracao_remessa desc);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists controle_remessa_erro;`);
  }
}
