import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTransacaoView1716311630313 implements MigrationInterface {
    name = 'CreateTransacaoView1716311630313'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
          `CREATE TABLE "transacao_view" ("id" SERIAL NOT NULL, "datetimeTransacao" TIMESTAMP NOT NULL, "datetimeProcessamento" TIMESTAMP NOT NULL, "datetimeCaptura" TIMESTAMP NOT NULL, "modo" character varying NOT NULL, "idConsorcio" character varying, "nomeConsorcio" character varying NOT NULL, "idOperadora" character varying, "nomeOperadora" character varying NOT NULL, "idTransacao" character varying NOT NULL, "tipoPagamento" character varying NOT NULL, "tipoTransacao" character varying, "tipoGratuidade" character varying, "valorTransacao" numeric NOT NULL, "arquivoPublicacaoId" integer, CONSTRAINT "UQ_TransacaoView_datetimeProcessamento" UNIQUE ("datetimeProcessamento"), CONSTRAINT "PK_TransacaoView_id" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`ALTER TABLE "transacao_view" ADD CONSTRAINT "FK_TransacaoView_arquivoPublicacao_ManyToOne" FOREIGN KEY ("arquivoPublicacaoId") REFERENCES "transacao_view"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacao_view" DROP CONSTRAINT "FK_TransacaoView_arquivoPublicacao_ManyToOne"`);
        await queryRunner.query(`DROP TABLE "transacao_view"`);
    }

}
