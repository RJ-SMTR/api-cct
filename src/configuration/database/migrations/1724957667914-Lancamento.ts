import { MigrationInterface, QueryRunner } from "typeorm";

export class Lancamento1724957667914 implements MigrationInterface {
    name = 'Lancamento1724957667914'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "auth_usersIds"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "autorizado_por" character varying`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_Lancamento_user_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "algoritmo"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "algoritmo" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_Lancamento_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_Lancamento_user_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "algoritmo"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "algoritmo" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_Lancamento_user_ManyToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "autorizado_por"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "auth_usersIds" character varying`);
    }

}
