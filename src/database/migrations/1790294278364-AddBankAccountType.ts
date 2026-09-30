import { MigrationInterface, QueryRunner } from "typeorm"

export class AddBankAccountType1790294278364 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user"
            ADD COLUMN IF NOT EXISTS "bankAccountType" VARCHAR NOT NULL DEFAULT 'corrente';
        `);

        await queryRunner.query(`
            ALTER TABLE ordem_pagamento_agrupado_historico
            ADD COLUMN IF NOT EXISTS "userBankAccountType" VARCHAR NOT NULL DEFAULT 'corrente';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ordem_pagamento_agrupado_historico DROP COLUMN IF EXISTS "userBankAccountType";`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "bankAccountType";`);
    }

}
