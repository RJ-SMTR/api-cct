import { MigrationInterface, QueryRunner } from "typeorm";

export class FixPagador1710183907844 implements MigrationInterface {
    name = 'FixPagador1710183907844'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_lancamento_usuario"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD "id_cliente_favorecido" integer`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pagador" DROP COLUMN "cpfCnpj"`);
        await queryRunner.query(`ALTER TABLE "pagador" ADD "cpfCnpj" character varying(14)`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_80f6744ced95ab9e8dd0b212fee" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_ea066846cf244204c813b72ff50" FOREIGN KEY ("id_cliente_favorecido") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_ea066846cf244204c813b72ff50"`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP CONSTRAINT "FK_80f6744ced95ab9e8dd0b212fee"`);
        await queryRunner.query(`ALTER TABLE "pagador" DROP COLUMN "cpfCnpj"`);
        await queryRunner.query(`ALTER TABLE "pagador" ADD "cpfCnpj" character varying(2)`);
        await queryRunner.query(`ALTER TABLE "lancamento" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "lancamento" DROP COLUMN "id_cliente_favorecido"`);
        await queryRunner.query(`ALTER TABLE "lancamento" ADD CONSTRAINT "FK_lancamento_usuario" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
