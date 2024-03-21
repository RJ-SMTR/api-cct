import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPermissionarioRole1710783706794 implements MigrationInterface {
    name = 'AddPermissionarioRole1710783706794'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "permissionario_role" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_6ff46caf12929c1af098392a373" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD "permissionarioRoleId" integer`);
        await queryRunner.query(`ALTER TABLE "user" ADD "permissionarioRoleId" integer`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" ADD CONSTRAINT "FK_a3b1b2008dce7aeffcbd6c42b6a" FOREIGN KEY ("permissionarioRoleId") REFERENCES "permissionario_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_2133f226b47417843ae3cb50d86" FOREIGN KEY ("permissionarioRoleId") REFERENCES "permissionario_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_2133f226b47417843ae3cb50d86"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP CONSTRAINT "FK_a3b1b2008dce7aeffcbd6c42b6a"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "permissionarioRoleId"`);
        await queryRunner.query(`ALTER TABLE "cliente_favorecido" DROP COLUMN "permissionarioRoleId"`);
        await queryRunner.query(`DROP TABLE "permissionario_role"`);
    }

}
