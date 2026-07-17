import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdemPagamentoGuardador1783515431599
  implements MigrationInterface {
  name = 'CreateOrdemPagamentoGuardador1783515431599';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ordem_pagamento_guardador" (
        "id" integer NOT NULL,
        "data_ordem" date NOT NULL,
        "id_status_ordem" integer NOT NULL,
        "id_ordem_pagamento_estacionamento" integer NOT NULL,
        "id_cliente" integer NOT NULL,
        "qtd_verificado" integer NOT NULL,
        "valor_unitario_verificado" numeric(13,5) NOT NULL,
        "valor_total_verificado" numeric(13,5) NOT NULL,
        "data_pagamento" date NOT NULL,
        "data_inclusao" date NOT NULL,
        "userId" integer NOT NULL,
        CONSTRAINT "PK_OrdemPagamentoGuardadorId" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "ordem_pagamento_guardador"
      ADD CONSTRAINT "FK_OrdemPagamentoGuardador_user_ManyToOne"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ordem_pagamento_guardador"
      DROP CONSTRAINT "FK_OrdemPagamentoGuardador_user_ManyToOne"
    `);
    await queryRunner.query(`DROP TABLE "ordem_pagamento_guardador"`);
  }
}