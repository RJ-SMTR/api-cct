import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserColumnsRegisterRoute1688151288998
  implements MigrationInterface
{
  name = 'UserColumnsRegisterRoute1688151288998';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "sgtuActive" boolean`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "sgtuActive"`);
  }
}
