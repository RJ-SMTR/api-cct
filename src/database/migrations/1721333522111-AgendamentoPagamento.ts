import { MigrationInterface, QueryRunner } from "typeorm";

export class AgendamentoPagamento1721333522111 implements MigrationInterface {
    name = 'AgendamentoPagamento1721333522111'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "agendamento_pagamento" ("id" SERIAL NOT NULL, "dataOrdemInicio" TIMESTAMP NOT NULL, "dataOrdemFim" TIMESTAMP NOT NULL, "dataPagamento" TIMESTAMP NOT NULL, "tipoRecorrencia" character varying NOT NULL, "recorrenciaDias" integer array, "recorrenciaSemana" character varying array, "isAtivo" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer, CONSTRAINT "PK_AgendamentoPagamento_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD CONSTRAINT "FK_AgendamentoPagamento_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP CONSTRAINT "FK_AgendamentoPagamento_user_ManyToOne"`);
        await queryRunner.query(`DROP TABLE "agendamento_pagamento"`);
    }

}
