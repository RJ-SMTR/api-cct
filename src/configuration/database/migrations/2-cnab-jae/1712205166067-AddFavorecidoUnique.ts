import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFavorecidoUnique1712205166067 implements MigrationInterface {
    name = 'AddFavorecidoUnique1712205166067'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_transacao" DROP COLUMN "dataTransacao"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "UQ_ClienteFavorecido_cpfCnpj" UNIQUE ("cpfCnpj")`);
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "loteServico" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivo_publicacao" ALTER COLUMN "loteServico" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "UQ_ClienteFavorecido_cpfCnpj"`);
        await queryRunner.query(`ALTER TABLE "item_transacao" ADD "dataTransacao" TIMESTAMP NOT NULL`);
    }

}
