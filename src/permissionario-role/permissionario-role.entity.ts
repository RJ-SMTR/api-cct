import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { Enum } from 'src/utils/enum';
import { PermissionarioRoleEnum } from 'src/permissionario-role/permissionario-role.enum';

@Entity()
export class PermissionarioRole extends EntityHelper {
  constructor(role?: PermissionarioRoleEnum) {
    super();
    if (role !== undefined) {
      this.id = role;
      this.name = Enum.getKey(PermissionarioRoleEnum, role);
    }
  }

  @ApiProperty({ example: 1 })
  @PrimaryColumn()
  id: number;

  @Allow()
  @ApiProperty({ example: 'vanzeiro' })
  @Column()
  name?: string;

  getEnum(): PermissionarioRoleEnum {
    return this.id;
  }
}
