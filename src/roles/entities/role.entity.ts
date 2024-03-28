import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { RoleEnum } from '../roles.enum';
import { Enum } from 'src/utils/enum';

@Entity()
export class Role extends EntityHelper {
  constructor(role?: RoleEnum) {
    super();
    if (role !== undefined) {
      this.id = role;
      this.name = Enum.getKey(RoleEnum, role);
    }
  }

  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_Role_id' })
  id: number;

  @Allow()
  @ApiProperty({ example: 'Admin' })
  @Column()
  name?: string;
}
