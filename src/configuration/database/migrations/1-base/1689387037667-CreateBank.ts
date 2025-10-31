import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBank1689387037667 implements MigrationInterface {
  name = 'CreateBank1689387037667';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bank" ("id" SERIAL NOT NULL, "ispb" integer NOT NULL, "name" character varying NOT NULL, "code" integer NOT NULL, "fullName" character varying NOT NULL, "isAllowed" boolean NOT NULL, CONSTRAINT "UQ_644e44c1a3cb9d4b431fb080160" UNIQUE ("ispb"), CONSTRAINT "UQ_efdd3f589f04cd21d79136de1aa" UNIQUE ("code"), CONSTRAINT "PK_7651eaf705126155142947926e8" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bank"`);
  }
}
