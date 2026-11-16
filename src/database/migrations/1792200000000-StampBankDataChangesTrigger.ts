import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stamps "user"."bankDataUpdatedAt" and "previousBankCode" in the database, so every write of the
 * bank data (bankCode, bankAgency, bankAccount, bankAccountDigit) gets them, not only writes made
 * through UsersRepository.update(). On 2026-11-10 a bulk UPDATE run in pgAdmin filled the bank data
 * of 150 guardadores and left the date NULL, so the CCT showed no date line for them.
 *
 * Same rules as UsersRepository.update() (values compared as trimmed text, NULL = ''):
 * - INSERT with any bank field filled and no date -> date = now (UTC);
 * - UPDATE that changes any bank field -> date = now, unless the writer set the date itself;
 * - UPDATE that changes bankCode from a filled one -> previousBankCode = old bankCode, unless the
 *   writer set previousBankCode itself.
 * The API keeps stamping both columns; the trigger then leaves its values alone.
 */
export class StampBankDataChangesTrigger1792200000000 implements MigrationInterface {
  name = 'StampBankDataChangesTrigger1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION stamp_user_bank_data() RETURNS trigger AS $$
      DECLARE
        bank_filled boolean;
        bank_changed boolean;
        code_changed boolean;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          bank_filled := COALESCE(TRIM(NEW."bankCode"::text), '') <> ''
            OR COALESCE(TRIM(NEW."bankAgency"), '') <> ''
            OR COALESCE(TRIM(NEW."bankAccount"), '') <> ''
            OR COALESCE(TRIM(NEW."bankAccountDigit"), '') <> '';
          IF bank_filled AND NEW."bankDataUpdatedAt" IS NULL THEN
            NEW."bankDataUpdatedAt" := now() AT TIME ZONE 'UTC';
          END IF;
          RETURN NEW;
        END IF;

        code_changed := COALESCE(TRIM(NEW."bankCode"::text), '') <> COALESCE(TRIM(OLD."bankCode"::text), '');
        bank_changed := code_changed
          OR COALESCE(TRIM(NEW."bankAgency"), '') <> COALESCE(TRIM(OLD."bankAgency"), '')
          OR COALESCE(TRIM(NEW."bankAccount"), '') <> COALESCE(TRIM(OLD."bankAccount"), '')
          OR COALESCE(TRIM(NEW."bankAccountDigit"), '') <> COALESCE(TRIM(OLD."bankAccountDigit"), '');

        IF bank_changed AND NEW."bankDataUpdatedAt" IS NOT DISTINCT FROM OLD."bankDataUpdatedAt" THEN
          NEW."bankDataUpdatedAt" := now() AT TIME ZONE 'UTC';
        END IF;
        IF code_changed
          AND COALESCE(TRIM(OLD."bankCode"::text), '') <> ''
          AND NEW."previousBankCode" IS NOT DISTINCT FROM OLD."previousBankCode" THEN
          NEW."previousBankCode" := OLD."bankCode";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS stamp_user_bank_data ON "user"`);
    await queryRunner.query(`
      CREATE TRIGGER stamp_user_bank_data
      BEFORE INSERT OR UPDATE ON "user"
      FOR EACH ROW EXECUTE FUNCTION stamp_user_bank_data()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS stamp_user_bank_data ON "user"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS stamp_user_bank_data()`);
  }
}
