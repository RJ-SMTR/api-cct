import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterTableAjustePadraoTabela1784747465298 implements MigrationInterface {
    name = 'AlterTableAjustePadraoTabela1784747465298'

    public async up(queryRunner: QueryRunner): Promise<void> {
       
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "quantidade_verificacao_invalida"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "quantidade_verificacao_valida"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "valor_repasse_guardador"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "data_inclusao"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "quantidade_verificacao_total"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "data_ordem"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "tipo_ordem_pagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "dataOrdem" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "qtdVerificacaoTotal" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "qtdVerificacaoValida" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "qtdVerificacaoInvalida" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "valorRepasseGuardador" numeric(13,5) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "dataInclusao" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "tipoOrdemPagamento" varchar(100) NOT NULL`);        
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "tipoOrdemPagamento"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "dataInclusao"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "valorRepasseGuardador"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "qtdVerificacaoInvalida"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "qtdVerificacaoValida"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "qtdVerificacaoTotal"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" DROP COLUMN "dataOrdem"`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "tipo_ordem_pagamento" varchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "data_ordem" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "quantidade_verificacao_total" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "data_inclusao" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "valor_repasse_guardador" numeric(13,5) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "quantidade_verificacao_valida" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ordem_pagamento_guardador" ADD "quantidade_verificacao_invalida" integer NOT NULL`);
    }

}