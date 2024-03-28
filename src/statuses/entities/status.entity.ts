import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { StatusEnum } from '../statuses.enum';
import { Enum } from 'src/utils/enum';

@Entity()
export class Status extends EntityHelper {
  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_Status_id' })
  id: number;

  @Allow()
  @ApiProperty({ example: 'Active' })
  @Column()
  name?: string;

  constructor(status?: StatusEnum) {
    super();
    if (status !== undefined) {
      this.id = status;
      this.name = Enum.getKey(StatusEnum, status);
    }
  }
}
