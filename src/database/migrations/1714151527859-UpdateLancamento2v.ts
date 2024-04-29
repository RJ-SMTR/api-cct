import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateLancamento2v1714151527859 implements MigrationInterface {
    name = 'UpdateLancamento2v1714151527859'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "codigoBanco"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "codigoBanco" character varying(3)`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "dvAgencia"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "dvAgencia" character varying(1)`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "dvContaCorrente"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "dvContaCorrente" character varying(1)`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "codigoBanco"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "codigoBanco" character varying(3)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "header_arquivo" DROP COLUMN "codigoBanco"`);
        await queryRunner.query(`ALTER TABLE "header_arquivo" ADD "codigoBanco" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "dvContaCorrente"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "dvContaCorrente" character varying(2)`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "dvAgencia"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "dvAgencia" character varying(2)`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "codigoBanco"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "codigoBanco" character varying(10)`);
    }

}
