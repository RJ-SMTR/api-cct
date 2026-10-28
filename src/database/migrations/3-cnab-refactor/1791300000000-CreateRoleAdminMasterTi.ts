import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoleAdminMasterTi1791300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `insert into role (id, name) values (7, 'Admin Master TI') on conflict (id) do nothing;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from role where id = 7;`);
  }
}
