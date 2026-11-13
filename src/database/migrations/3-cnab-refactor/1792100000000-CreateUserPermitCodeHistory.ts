import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPermitCodeHistory1792100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.user_permit_code_history (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
        permit_code character varying NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_permit_code_history_user ON public.user_permit_code_history (user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_permit_code_history_code ON public.user_permit_code_history (permit_code);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.user_permit_code_history;`);
  }
}
