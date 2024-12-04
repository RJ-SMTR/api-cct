import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatePgtoIndevido1732654821584 implements MigrationInterface {
  name = 'UpdatePgtoIndevido1732654821584';

  public async up(queryRunner: QueryRunner): Promise<void> {    
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataPagamento"`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataPagamento" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataReferencia"`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataReferencia" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" TYPE numeric(10,5)`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" TYPE numeric(10,5)`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" TYPE numeric(10,5)`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "saldoDevedor" TYPE numeric`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPagar" TYPE numeric`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ALTER COLUMN "valorPago" TYPE numeric`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataReferencia"`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataReferencia" date`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" DROP COLUMN "dataPagamento"`);
    await queryRunner.query(`ALTER TABLE "pagamento_indevido" ADD "dataPagamento" date NOT NULL`);  
  }
}
