import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClienteFavorecido1709760544016 implements MigrationInterface {
    name = 'AddClienteFavorecido1709760544016'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "Cliente_Favorecido" ("id_cliente_favorecido" SERIAL NOT NULL, "nome" character varying(150) NOT NULL, "cpf_cnpj" character varying(14), "cod_banco" character varying(10), "agencia" character varying(5), "dv_agencia" character varying(2), "conta_corrente" character varying(12), "dv_conta_corrente" character varying(2), "logradouro" character varying(200), "numero" character varying(15), "complemento" character varying(100), "bairro" character varying(150), "cidade" character varying(150), "cep" character varying(5), "complemento_cep" character varying(3), "uf" character varying(2), CONSTRAINT "PK_7b620f1eb781f26481c59ef8005" PRIMARY KEY ("id_cliente_favorecido"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "Cliente_Favorecido"`);
    }

}
