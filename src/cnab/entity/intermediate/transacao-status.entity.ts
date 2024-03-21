import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { Enum } from 'src/utils/enum';
import { TransacaoStatusEnum } from '../../enums/intermediate/transacao-status.enum';

@Entity()
export class TransacaoStatus extends EntityHelper {
  constructor(role?: TransacaoStatusEnum, onlyId = true) {
    super();
    if (role !== undefined) {
      this.id = role;
      if (!onlyId) {
        this.name = Enum.getKey(TransacaoStatusEnum, role);
      }
    }
  }

  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_TransacaoStatus_id' })
  id: number;

  @Allow()
  @ApiProperty({ example: 'vanzeiro' })
  @Column()
  name?: string;

  getEnum(): TransacaoStatusEnum {
    return this.id;
  }
}
