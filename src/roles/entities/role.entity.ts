import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { RoleEnum } from '../roles.enum';
import { getEnumKey } from 'src/utils/get-enum-key';

@Entity()
export class Role extends EntityHelper {
  @ApiProperty({ example: 1 })
  @PrimaryColumn()
  id: number;

  @Allow()
  @ApiProperty({ example: 'Admin' })
  @Column()
  name?: string;

  constructor(role?: RoleEnum) {
    super();
    if (role !== undefined) {
      this.id = role;
      this.name = getEnumKey(RoleEnum, role);
    }
  }
}
