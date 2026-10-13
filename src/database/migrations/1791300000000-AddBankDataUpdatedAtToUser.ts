import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds "user"."bankDataUpdatedAt": when the bank data (bankCode, bankAgency,
 * bankAccount, bankAccountDigit) was last filled or changed (issue #1192).
 *
 * Backfill keeps the date the bank data card already showed:
 * - previousBankCode set -> updatedAt (approximate: updatedAt also moves on
 *   non-bank changes);
 * - bank data set, no previousBankCode -> createdAt;
 * - no bank data -> NULL.
 *
 * user_update_trigger (created outside migrations, logs every UPDATE on
 * "user" into user_changes_log) is disabled during the backfill: the backfill
 * is not a user change and must not add one log row per user. The trigger's
 * previous state is restored afterwards; environments without it are skipped.
 * Everything runs in the migration transaction, so a failure rolls back the
 * trigger state too.
 */
export class AddBankDataUpdatedAtToUser1791300000000 implements MigrationInterface {
    name = 'AddBankDataUpdatedAtToUser1791300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "bankDataUpdatedAt" TIMESTAMP`);

        const [trigger] = await queryRunner.query(`
            SELECT tgenabled FROM pg_trigger
            WHERE tgrelid = '"user"'::regclass AND tgname = 'user_update_trigger'
        `);
        const restoreTrigger = trigger && trigger.tgenabled !== 'D'
            ? { O: 'ENABLE', A: 'ENABLE ALWAYS', R: 'ENABLE REPLICA' }[trigger.tgenabled as 'O' | 'A' | 'R']
            : undefined;
        if (restoreTrigger) {
            await queryRunner.query(`ALTER TABLE "user" DISABLE TRIGGER user_update_trigger`);
        }

        await queryRunner.query(`
            UPDATE "user" SET "bankDataUpdatedAt" = "updatedAt"
            WHERE "previousBankCode" IS NOT NULL
        `);
        await queryRunner.query(`
            UPDATE "user" SET "bankDataUpdatedAt" = "createdAt"
            WHERE "previousBankCode" IS NULL
              AND (
                "bankCode" IS NOT NULL
                OR NULLIF(TRIM("bankAgency"), '') IS NOT NULL
                OR NULLIF(TRIM("bankAccount"), '') IS NOT NULL
                OR NULLIF(TRIM("bankAccountDigit"), '') IS NOT NULL
              )
        `);

        if (restoreTrigger) {
            await queryRunner.query(`ALTER TABLE "user" ${restoreTrigger} TRIGGER user_update_trigger`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "bankDataUpdatedAt"`);
    }

}
