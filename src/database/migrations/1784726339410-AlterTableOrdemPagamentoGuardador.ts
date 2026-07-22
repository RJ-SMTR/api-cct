import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterTableOrdemPagamentoGuardador1784726339410 implements MigrationInterface {
    name = 'AlterTableOrdemPagamentoGuardador1784726339410'

    public async up(queryRunner: QueryRunner): Promise<void> {    
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "valor_total_verificado"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "valor_repasse_guardador" numeric(13,5) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "ordemPagamentoAgrupadoId" integer`);                   
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD CONSTRAINT "FK_OrdemPagamentoGuardador_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD CONSTRAINT "FK_OrdemPagamentoAgrupado_ManyToOne" FOREIGN KEY ("ordemPagamentoAgrupadoId") REFERENCES "ordem_pagamento_agrupado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP CONSTRAINT "FK_OrdemPagamentoAgrupado_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP CONSTRAINT "FK_OrdemPagamentoGuardador_user_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "ordemPagamentoAgrupadoId"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "valor_repasse_guardador"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "valor_total_verificado" numeric(13,5) NOT NULL`);        
    }

}
