import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInviteSettingsMailcount1696856145397
  implements MigrationInterface
{
  name = 'CreateInviteSettingsMailcount1696856145397';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "invite_status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_bfcd7854096256be37cd3b47b16" UNIQUE ("name"), CONSTRAINT "PK_476a43c747978d793e7a82bb0af" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invite" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "hash" character varying NOT NULL, "smtpErrorCode" integer, "httpErrorCode" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP, "failedAt" TIMESTAMP, "sentAt" TIMESTAMP, "deletedAt" TIMESTAMP, "userId" integer, "inviteStatusId" integer, CONSTRAINT "UQ_dbcbf85f7e3e27d864631d1cf14" UNIQUE ("hash"), CONSTRAINT "PK_fc9fa190e5a3c5d80604a4f63e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "setting_type" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_a4b944907a7b757fc5a4f91ba5e" UNIQUE ("name"), CONSTRAINT "PK_e423059281ed2740a3de81bd149" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mail_count" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "recipientCount" integer NOT NULL, "maxRecipients" integer NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_426e0538ee56b8771e2cc5fee07" UNIQUE ("email"), CONSTRAINT "PK_0d21bf669f46d5df78f6b7004e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "setting" ("id" integer NOT NULL, "name" character varying NOT NULL, "value" character varying NOT NULL, "version" character varying, "editable" boolean NOT NULL, "settingTypeId" integer, CONSTRAINT "UQ_91a4f31e402dfa1da9b200ef924" UNIQUE ("name", "version"), CONSTRAINT "PK_fcb21187dc6094e24a48f677bed" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite" ADD CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite" ADD CONSTRAINT "FK_118ec7f671543d9b992512e7cb9" FOREIGN KEY ("inviteStatusId") REFERENCES "invite_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "setting" ADD CONSTRAINT "FK_a5bc5fbecc0b218be61ef25b725" FOREIGN KEY ("settingTypeId") REFERENCES "setting_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "setting" DROP CONSTRAINT "FK_a5bc5fbecc0b218be61ef25b725"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite" DROP CONSTRAINT "FK_118ec7f671543d9b992512e7cb9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invite" DROP CONSTRAINT "FK_91bfeec7a9574f458e5b592472d"`,
    );
    await queryRunner.query(`DROP TABLE "setting"`);
    await queryRunner.query(`DROP TABLE "mail_count"`);
    await queryRunner.query(`DROP TABLE "setting_type"`);
    await queryRunner.query(`DROP TABLE "invite"`);
    await queryRunner.query(`DROP TABLE "invite_status"`);
  }
}
