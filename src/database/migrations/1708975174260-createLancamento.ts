import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLancamento1708975174260 implements MigrationInterface {
  name = 'CreateLancamento1708975174260';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lancamento" (
                "id" SERIAL NOT NULL, 
                "descricao" character varying NOT NULL, 
                "valor" numeric NOT NULL,
                "data_ordem" TIMESTAMP NOT NULL DEFAULT now(), 
                "data_pgto" TIMESTAMP NOT NULL DEFAULT now(), 
                "data_lancamento" TIMESTAMP NOT NULL DEFAULT now(), 
                "auth_usersIds" character varying, 
                "userId" integer, 
                "algoritmo" integer NOT NULL,
                "glosa" integer NOT NULL,
                "recurso" integer NOT NULL,
                "valor_a_pagar" integer NOT NULL,
                "numero_processo" integer NOT NULL,
                CONSTRAINT "PK_133f2e1e4c9e3e9f2f6b1b0b345" PRIMARY KEY ("id"),
                CONSTRAINT "FK_lancamento_usuario" FOREIGN KEY ("userId") REFERENCES "user" ("id")
            )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lancamento" DROP CONSTRAINT "FK_lancamento_usuario"`,
    );
    await queryRunner.query(`DROP TABLE "lancamento"`);
  }
}
