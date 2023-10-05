import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSetting1696521658711 implements MigrationInterface {
  name = 'CreateSetting1696521658711';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "setting_type" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_a4b944907a7b757fc5a4f91ba5e" UNIQUE ("name"), CONSTRAINT "PK_e423059281ed2740a3de81bd149" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "setting" ("id" integer NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, "version" character varying, "editable" boolean NOT NULL, "settingTypeId" integer, CONSTRAINT "UQ_91a4f31e402dfa1da9b200ef924" UNIQUE ("name", "version"), CONSTRAINT "PK_fcb21187dc6094e24a48f677bed" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "setting" ADD CONSTRAINT "FK_a5bc5fbecc0b218be61ef25b725" FOREIGN KEY ("settingTypeId") REFERENCES "setting_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "setting" DROP CONSTRAINT "FK_a5bc5fbecc0b218be61ef25b725"`,
    );
    await queryRunner.query(`DROP TABLE "setting"`);
    await queryRunner.query(`DROP TABLE "setting_type"`);
  }
}
