import { MigrationInterface, QueryRunner } from "typeorm";

export class PagamentosPendentes1720624261462 implements MigrationInterface {
    name = 'PagamentosPendentes1720624261462'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "pagamentos_pendentes" ("id" SERIAL NOT NULL, "valorLancamento" numeric(13,2), "dataOrdem" TIMESTAMP, "dataVencimento" TIMESTAMP, "ocorrenciaErro" character varying, "clienteFavorecidoId" integer, CONSTRAINT "PK_Pagamentos_Pendentes_id" PRIMARY KEY ("id"))`);      
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" ADD CONSTRAINT "FK_PagamentosPendentes_clienteFavorecido_ManyToOne" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" DROP CONSTRAINT "FK_PagamentosPendentes_clienteFavorecido_ManyToOne"`);       
        await queryRunner.query(`DROP TABLE "pagamentos_pendentes"`);
    }

}
