import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { StatusEnum } from '../statuses.enum';
import { getEnumKey } from 'src/utils/enum-utils';

@Entity()
export class Status extends EntityHelper {
  @ApiProperty({ example: 1 })
  @PrimaryColumn()
  id: number;

  @Allow()
  @ApiProperty({ example: 'Active' })
  @Column()
  name?: string;

  constructor(status?: StatusEnum) {
    super();
    if (status !== undefined) {
      this.id = status;
      this.name = getEnumKey(StatusEnum, status);
    }
  }
}
