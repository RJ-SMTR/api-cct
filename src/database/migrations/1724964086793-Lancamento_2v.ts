import { MigrationInterface, QueryRunner } from "typeorm";

export class Lancamento2v1724964086793 implements MigrationInterface {
    name = 'Lancamento2v1724964086793'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_Lancamento_user_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "valor_a_pagar"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "descricao"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "autorId" integer`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "data_pgto" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "data_pgto" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "glosa" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "recurso" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "anexo" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_Lancamento_autor_ManyToOne" FOREIGN KEY ("autorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_Lancamento_autor_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "anexo" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "recurso" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "glosa" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "data_pgto" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "data_pgto" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "autorId"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "descricao" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "valor_a_pagar" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "userId" integer`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_Lancamento_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
