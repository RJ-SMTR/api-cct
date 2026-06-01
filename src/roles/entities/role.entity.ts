import { AfterLoad, Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { RoleEnum } from '../roles.enum';

const ROLE_NAME_BY_ID: Record<RoleEnum, string> = {
  [RoleEnum.master]: 'Admin Master',
  [RoleEnum.admin]: 'Admin',
  [RoleEnum.user]: 'User',
  [RoleEnum.lancador_financeiro]: 'Lançador financeiro',
  [RoleEnum.aprovador_financeiro]: 'Aprovador financeiro',
  [RoleEnum.agents]: 'Agentes',
};

@Entity()
export class Role extends EntityHelper {
  constructor(role?: RoleEnum) {
    super();
    if (role !== undefined) {
      this.id = role;
      this.name = Role.getCanonicalName(role);
    }
  }

  @AfterLoad()
  syncCanonicalName(): void {
    const canonicalName = Role.getCanonicalName(this.id);
    if (canonicalName) {
      this.name = canonicalName;
    }
  }

  static getCanonicalName(roleId?: number): string | undefined {
    if (roleId === undefined || roleId === null) {
      return undefined;
    }

    return ROLE_NAME_BY_ID[roleId as RoleEnum];
  }

  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_Role_id' })
  id: number;

  @Allow()
  @ApiProperty({ example: 'Admin' })
  @Column()
  name?: string;
}
