import { MigrationInterface, QueryRunner } from "typeorm";

export class TransacaoView1720214573088 implements MigrationInterface {
    name = 'TransacaoView1720214573088'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // await queryRunner.query(`ALTER TABLE "file" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "transacao_view" ALTER COLUMN "modo" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_User_photo_ManyToOne" FOREIGN KEY ("photoId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_User_photo_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "transacao_view" ALTER COLUMN "modo" SET NOT NULL`);
        // await queryRunner.query(`ALTER TABLE "file" ALTER COLUMN "id" DROP DEFAULT`);
    }

}
