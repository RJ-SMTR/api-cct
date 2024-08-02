import { MigrationInterface, QueryRunner } from "typeorm";

export class AdicionColunaIdTransacaoViewItemTransacao1721848566340 implements MigrationInterface {
    name = 'AdicionColunaIdTransacaoViewItemTransacao1721848566340'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "idTransacaoView" character varying NULL`);
        // await queryRunner.query(`ALTER TABLE "file" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);        
    }

    public async down(queryRunner: QueryRunner): Promise<void> {        
        // await queryRunner.query(`ALTER TABLE "file" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "idTransacaoView"`);
    }

}
