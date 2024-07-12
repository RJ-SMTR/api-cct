import { MigrationInterface, QueryRunner } from "typeorm";

export class PagamentosPendentes1720632860981 implements MigrationInterface {
    name = 'PagamentosPendentes1720632860981'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" DROP CONSTRAINT "FK_PagamentosPendentes_clienteFavorecido_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" DROP COLUMN "clienteFavorecidoId"`);
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" DROP COLUMN "dataOrdem"`);
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" ADD "nomeFavorecido" character varying`);
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" ADD "nsr" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" DROP COLUMN "nsr"`);
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" DROP COLUMN "nomeFavorecido"`);
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" ADD "dataOrdem" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" ADD "clienteFavorecidoId" integer`);
        await queryRunner.query(`ALTER TABLE "pagamentos_pendentes" ADD CONSTRAINT "FK_PagamentosPendentes_clienteFavorecido_ManyToOne" FOREIGN KEY ("clienteFavorecidoId") REFERENCES "cliente_favorecido"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
