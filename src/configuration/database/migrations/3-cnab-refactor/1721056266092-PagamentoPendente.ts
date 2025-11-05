import { MigrationInterface, QueryRunner } from "typeorm";

export class PagamentoPendente1721056266092 implements MigrationInterface {
    name = 'PagamentoPendente1721056266092'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "pagamentos_pendentes" ("id" SERIAL NOT NULL, "nomeFavorecido" character varying, "valorLancamento" numeric(13,2), "dataVencimento" TIMESTAMP, "numeroDocumento" character varying, "ocorrenciaErro" character varying, CONSTRAINT "PK_Pagamentos_Pendentes_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "pagamentos_pendentes"`);
    }

}
