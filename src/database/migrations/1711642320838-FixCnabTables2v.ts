import { MigrationInterface, QueryRunner } from "typeorm";

export class FixCnabTables2v1711642320838 implements MigrationInterface {
    name = 'FixCnabTables2v1711642320838'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_User_permissionarioRole_ManyToOne"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "FK_ClienteFavorecido_permissionarioRole_ManyToOne"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_Forgot_hash"`);
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "UQ_Setting_name_version"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" RENAME COLUMN "permissionarioRoleId" TO "tipo"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "permissionarioRoleId"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "tipo"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "tipo" character varying`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "quantidadeMoeda" TYPE numeric(10,5)`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "valorLancamento" TYPE numeric(13,2)`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "valorRealEfetivado" TYPE numeric(13,2)`);
        await queryRunner.query(`CREATE INDEX "IDX_df507d27b0fb20cd5f7bef9b9a" ON "forgot" ("hash") `);
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "UQ_Setting_name_version" UNIQUE ("name", "version")`);
        await queryRunner.query(`DROP TABLE "permissionario_role"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "setting" DROP CONSTRAINT "UQ_Setting_name_version"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_df507d27b0fb20cd5f7bef9b9a"`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "valorRealEfetivado" TYPE numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "valorLancamento" TYPE numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "detalhe_a" ALTER COLUMN "quantidadeMoeda" TYPE numeric(5,10)`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "tipo"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "tipo" integer`);
        await queryRunner.query(`ALTER TABLE "user" ADD "permissionarioRoleId" integer`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" RENAME COLUMN "tipo" TO "permissionarioRoleId"`);
        await queryRunner.query(`ALTER TABLE "setting" ADD CONSTRAINT "UQ_Setting_name_version" UNIQUE ("name", "version")`);
        await queryRunner.query(`CREATE INDEX "IDX_Forgot_hash" ON "forgot" ("hash") `);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "FK_ClienteFavorecido_permissionarioRole_ManyToOne" FOREIGN KEY ("permissionarioRoleId") REFERENCES "permissionario_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_User_permissionarioRole_ManyToOne" FOREIGN KEY ("permissionarioRoleId") REFERENCES "permissionario_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
