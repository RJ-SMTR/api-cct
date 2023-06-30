import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterUserColumns1688071365457 implements MigrationInterface {
  name = 'AlterUserColumns1688071365457';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "permissionCode"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "cpf"`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD "licensee" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "cpfCnpj" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_035190f70c9aff0ef331258d28" ON "user" ("fullName") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_035190f70c9aff0ef331258d28"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "cpfCnpj"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "licensee"`);
    await queryRunner.query(`ALTER TABLE "user" ADD "cpf" character varying`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD "permissionCode" character varying`,
    );
  }
}
