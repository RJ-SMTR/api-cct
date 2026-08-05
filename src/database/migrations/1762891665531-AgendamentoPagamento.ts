import { MigrationInterface, QueryRunner } from "typeorm";

export class AgendamentoPagamento1762891665531 implements MigrationInterface {
    name = 'AgendamentoPagamento1762891665531'

    public async up(queryRunner: QueryRunner): Promise<void> {   
        await queryRunner.query(`CREATE TABLE "aprovacao_pagamento" ("id" SERIAL NOT NULL, "valorGerado" numeric(13,5), "valorAprovado" numeric(13,5), "dataAprovacao" date NOT NULL, "status" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "detalheAId" integer, "aprovadorId" integer, CONSTRAINT "PK_AprovacaoPagamentoId" PRIMARY KEY ("id"))`);
      await queryRunner.query(`
  CREATE TABLE "agendamento_pagamento" (
    "id" SERIAL NOT NULL,
    "tipoBeneficiario" character varying(200),
    "tipoPagamento" character varying(200),
    "dataPagamentoUnico" date,
    "valorPagamentoUnico" numeric(13,5),
    "motivoPagamentoUnico" character varying,
    "diaSemana" integer,
    "horario" TIME,
    "aprovacao" boolean,
    "status" boolean,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "beneficiarioUsuarioId" integer,
    "pagadorId" integer,
    "responsavelId" integer,
    "aprovacaoPagamentoId" integer,
    "cadastradorId" integer,
    "modificadorId" integer,
    CONSTRAINT "PK_AgendamentoPagamentoId" PRIMARY KEY ("id")
  )
`);

        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ADD CONSTRAINT "FK_DetalheA_ManyToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" ADD CONSTRAINT "FK_AprovadorUsuario_ManyToOne" FOREIGN KEY ("aprovadorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD CONSTRAINT "FK_BeneficiarioUsuario_ManyToOne" FOREIGN KEY ("beneficiarioUsuarioId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD CONSTRAINT "FK_Pagador_ManyToOne" FOREIGN KEY ("pagadorId") REFERENCES "pagador"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD CONSTRAINT "FK_ResponsavelUsuario_ManyToOne" FOREIGN KEY ("responsavelId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD CONSTRAINT "FK_AprovacaoPagamento_ManyToOne" FOREIGN KEY ("aprovacaoPagamentoId") REFERENCES "aprovacao_pagamento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD CONSTRAINT "FK_CadastradorUsuario_ManyToOne" FOREIGN KEY ("cadastradorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" ADD CONSTRAINT "FK_ModificadorUsario_ManyToOne" FOREIGN KEY ("modificadorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP CONSTRAINT "FK_ModificadorUsario_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP CONSTRAINT "FK_CadastradorUsuario_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP CONSTRAINT "FK_AprovacaoPagamento_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP CONSTRAINT "FK_ResponsavelUsuario_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP CONSTRAINT "FK_Pagador_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "agendamento_pagamento" DROP CONSTRAINT "FK_BeneficiarioUsuario_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" DROP CONSTRAINT "FK_AprovadorUsuario_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "aprovacao_pagamento" DROP CONSTRAINT "FK_DetalheA_ManyToOne"`);     
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "bloqueado" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "updatedAt" SET DEFAULT now()`);        
        await queryRunner.query(`DROP TABLE "agendamento_pagamento"`);
        await queryRunner.query(`DROP TABLE "aprovacao_pagamento"`);       
    }

}
