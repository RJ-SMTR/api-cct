import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInfo1687403553617 implements MigrationInterface {
  name = 'CreateInfo1687403553617';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "info" ("id" integer NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "UQ_916df6cf672c24f99ceab946a88" UNIQUE ("name"), CONSTRAINT "PK_687dc5e25f4f1ee093a45b68bb7" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "info"`);
  }
}
