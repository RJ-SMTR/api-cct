import { MigrationInterface, QueryRunner } from "typeorm";

export class DecouplePublicacao1724436146343 implements MigrationInterface {
    name = 'DecouplePublicacao1724436146343'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "horaGeracaoRetorno"`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" DROP COLUMN "idTransacao"`);
        await queryRunner.query(`ALTER TABLE "file" DROP CONSTRAINT "PK_File_id"`);
        await queryRunner.query(`ALTER TABLE "file" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "file" ADD "id" SERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "file" ADD CONSTRAINT "PK_File_id" PRIMARY KEY ("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "file" DROP CONSTRAINT "PK_File_id"`);
        await queryRunner.query(`ALTER TABLE "file" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "file" ADD "id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "file" ADD CONSTRAINT "PK_File_id" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "idTransacao" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ADD "horaGeracaoRetorno" TIMESTAMP`);
    }

}
