import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOcorrencia1714764255864 implements MigrationInterface {
    name = 'CreateOcorrencia1714764255864'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "transacao_ocorrencia"`);
        await queryRunner.query(`CREATE TABLE "ocorrencia" ("id" SERIAL NOT NULL, "code" character varying(2) NOT NULL, "message" character varying(100) NOT NULL, "headerArquivoId" integer, "detalheAId" integer, CONSTRAINT "UQ_6ff1f74718ae1fa9496becd4ffe" UNIQUE ("code"), CONSTRAINT "PK_Ocorrencia_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" ADD CONSTRAINT "FK_TransacaoOcorrencia_headerArquivo_ManyToOne" FOREIGN KEY ("headerArquivoId") REFERENCES "header_arquivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" ADD CONSTRAINT "FK_TransacaoOcorrencia_detalheA_ManyToOne" FOREIGN KEY ("detalheAId") REFERENCES "detalhe_a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
    
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ocorrencia" DROP CONSTRAINT "FK_TransacaoOcorrencia_detalheA_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "ocorrencia" DROP CONSTRAINT "FK_TransacaoOcorrencia_headerArquivo_ManyToOne"`);
        await queryRunner.query(`DROP TABLE "ocorrencia"`);
        await queryRunner.query(
          `CREATE TABLE public.transacao_ocorrencia ( id serial4 NOT NULL, code varchar(2) NOT NULL, message varchar(100) NOT NULL, "transacaoId" int4 NULL, CONSTRAINT "PK_Ocorrencia_id" PRIMARY KEY (id), CONSTRAINT "UQ_TransacaoOcorrencia_code" UNIQUE (code) );`,
        );
    }

}
