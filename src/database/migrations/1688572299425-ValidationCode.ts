import { MigrationInterface, QueryRunner } from 'typeorm';

export class ValidationCode1688572299425 implements MigrationInterface {
  name = 'ValidationCode1688572299425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "validation_code_destination" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_d68d969553c40a660e8a0c40b32" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "validation_code_method" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_6d528ff2a22f67f49e3db8c7c20" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "validation_code" ("id" SERIAL NOT NULL, "hash" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP, "deletedAt" TIMESTAMP, "userId" integer, "destinationId" integer, "methodId" integer, CONSTRAINT "PK_fefcbba81f8a328e2e2927d5411" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e43dcdd4c7ca4207d2de6d9ac" ON "validation_code" ("hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "isPhoneValidated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "validation_code" ADD CONSTRAINT "FK_cdf4d9366bd60caf89a57abe521" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "validation_code" ADD CONSTRAINT "FK_6ec8262374cb3a97ea1026a8112" FOREIGN KEY ("destinationId") REFERENCES "validation_code_destination"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "validation_code" ADD CONSTRAINT "FK_3b8a3568818789437bd842b05e7" FOREIGN KEY ("methodId") REFERENCES "validation_code_method"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "validation_code" DROP CONSTRAINT "FK_3b8a3568818789437bd842b05e7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "validation_code" DROP CONSTRAINT "FK_6ec8262374cb3a97ea1026a8112"`,
    );
    await queryRunner.query(
      `ALTER TABLE "validation_code" DROP CONSTRAINT "FK_cdf4d9366bd60caf89a57abe521"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "isPhoneValidated"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e43dcdd4c7ca4207d2de6d9ac"`,
    );
    await queryRunner.query(`DROP TABLE "validation_code"`);
    await queryRunner.query(`DROP TABLE "validation_code_method"`);
    await queryRunner.query(`DROP TABLE "validation_code_destination"`);
  }
}
