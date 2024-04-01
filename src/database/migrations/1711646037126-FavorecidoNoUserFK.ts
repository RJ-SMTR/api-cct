import { MigrationInterface, QueryRunner } from "typeorm";

export class FavorecidoNoUserFK1711646037126 implements MigrationInterface {
    name = 'FavorecidoNoUserFK1711646037126'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "FK_ClienteFavorecido_user_OneToOne"`);
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "UQ_Setting_name_version"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "UQ_ClienteFavorecido_user"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "UQ_Setting_name_version" UNIQUE ("name", "version")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "UQ_Setting_name_version"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "userId" integer`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "UQ_ClienteFavorecido_user" UNIQUE ("userId")`);
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "UQ_Setting_name_version" UNIQUE ("name", "version")`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "FK_ClienteFavorecido_user_OneToOne" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
