import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { Enum } from 'src/utils/enum';
import { ItemTransacaoStatusEnum } from '../../enums/pagamento/item-transacao-status.enum';

@Entity()
export class ItemTransacaoStatus extends EntityHelper {
  constructor(id?: ItemTransacaoStatusEnum, onlyId = true) {
    super();
    if (id !== undefined) {
      this.id = id;
      if (!onlyId) {
        this.name = Enum.getKey(ItemTransacaoStatusEnum, id);
      }
    }
  }

  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_ItemTransacaoStatusId_id' })
  id: number;

  @Allow()
  @ApiProperty({ example: 'vanzeiro' })
  @Column()
  name?: string;

  getEnum(): ItemTransacaoStatusEnum {
    return this.id;
  }
}
