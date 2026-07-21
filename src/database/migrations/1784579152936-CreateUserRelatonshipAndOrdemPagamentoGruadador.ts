import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserRelatonshipAndOrdemPagamentoGruadador1784579152936 implements MigrationInterface {
    name = 'CreateUserRelatonshipAndOrdemPagamentoGruadador1784579152936'

    public async up(queryRunner: QueryRunner): Promise<void> {      
        await queryRunner.query(`CREATE TABLE "user_relationships" ("user_id" integer NOT NULL, "related_user_id" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_075a3168e04a27bb8734e0192e0" PRIMARY KEY ("user_id", "related_user_id"))`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "data_pagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "valor_unitario_verificado"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "id_status_ordem"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "id_ordem_pagamento_estacionamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "qtd_verificado"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "id_cliente"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "quantidade_verificacao_total" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "quantidade_verificacao_valida" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "quantidade_verificacao_invalida" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "updatedAt" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "bloqueado" DROP DEFAULT`);       
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP CONSTRAINT "FK_OrdemPagamentoGuardador_user_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_relationships" ADD CONSTRAINT "FK_f5e2b28cf1fcbde676fc896acce" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_relationships" ADD CONSTRAINT "FK_36f19b01965cfe0266aa1b74148" FOREIGN KEY ("related_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP CONSTRAINT "FK_OrdemPagamentoGuardador_user_ManyToOne"`);       
        await queryRunner.query(`ALTER TABLE "user_relationships" DROP CONSTRAINT "FK_36f19b01965cfe0266aa1b74148"`);
        await queryRunner.query(`ALTER TABLE "user_relationships" DROP CONSTRAINT "FK_f5e2b28cf1fcbde676fc896acce"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD CONSTRAINT "FK_OrdemPagamentoGuardador_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_agrupado" ALTER COLUMN "ordemPagamentoAgrupadoId" DROP NOT NULL`);       
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "bloqueado" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "updatedAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "quantidade_verificacao_invalida"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "quantidade_verificacao_valida"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "quantidade_verificacao_total"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "id_cliente" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "qtd_verificado" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "id_ordem_pagamento_estacionamento" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "id_status_ordem" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "valor_unitario_verificado" numeric(13,5) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "data_pagamento" date NOT NULL`);
        await queryRunner.query(`DROP TABLE "user_relationships"`);        
    }

}
