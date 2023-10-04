import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvite1696441921167 implements MigrationInterface {
  name = 'CreateInvite1696441921167';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "invite_status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_bfcd7854096256be37cd3b47b16" UNIQUE ("name"), CONSTRAINT "PK_476a43c747978d793e7a82bb0af" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invite" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "hash" character varying NOT NULL, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer, "inviteStatusId" integer, CONSTRAINT "UQ_dbcbf85f7e3e27d864631d1cf14" UNIQUE ("hash"), CONSTRAINT "PK_fc9fa190e5a3c5d80604a4f63e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite" ADD CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite" ADD CONSTRAINT "FK_118ec7f671543d9b992512e7cb9" FOREIGN KEY ("inviteStatusId") REFERENCES "invite_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invite" DROP CONSTRAINT "FK_118ec7f671543d9b992512e7cb9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite" DROP CONSTRAINT "FK_91bfeec7a9574f458e5b592472d"`,
    );
    await queryRunner.query(`DROP TABLE "invite"`);
    await queryRunner.query(`DROP TABLE "invite_status"`);
  }
}
