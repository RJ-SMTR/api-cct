import { MigrationInterface, QueryRunner } from 'typeorm';

export class ColumnInfoVersion1687533339069 implements MigrationInterface {
  name = 'ColumnInfoVersion1687533339069';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "info" ADD "version" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "info" DROP COLUMN "version"`);
  }
}
