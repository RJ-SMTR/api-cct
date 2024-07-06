import { MigrationInterface, QueryRunner } from "typeorm";

export class ClienteFavorecidoUser1720105734017 implements MigrationInterface {
    name = 'ClienteFavorecidoUser1720105734017'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "userId" integer`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "UQ_ClienteFavorecido_user" UNIQUE ("userId")`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "FK_ClienteFavorecido_user_OneToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "FK_ClienteFavorecido_user_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "UQ_ClienteFavorecido_user"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "userId"`);
    }

}
