import { Column, DeepPartial, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { Enum } from 'src/utils/enum';
import { TransacaoStatusEnum } from '../../enums/pagamento/transacao-status.enum';

@Entity()
export class TransacaoStatus extends EntityHelper {
  constructor(dto?: DeepPartial<TransacaoStatus>) {
    super();
    if (dto !== undefined) {
      Object.assign(this, dto);
    }
  }

  public static fromEnum(role?: TransacaoStatusEnum, onlyId = true) {
    const status = new TransacaoStatus();
    if (role !== undefined) {
      status.id = role;
      if (!onlyId) {
        status.name = Enum.getKey(TransacaoStatusEnum, role);
      }
    }
    return status;
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
