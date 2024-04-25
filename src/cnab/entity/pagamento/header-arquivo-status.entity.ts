import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { HeaderArquivoStatusEnum } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { EntityHelper } from 'src/utils/entity-helper';
import { Enum } from 'src/utils/enum';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class HeaderArquivoStatus extends EntityHelper {
  constructor(role?: HeaderArquivoStatusEnum, onlyId = true) {
    super();
    if (role !== undefined) {
      this.id = role;
      if (!onlyId) {
        this.name = Enum.getKey(HeaderArquivoStatusEnum, role);
      }
    }
  }

  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_HeaderArquivoStatus_id' })
  id: number;

  @Allow()
  @ApiProperty({ example: 'vanzeiro' })
  @Column()
  name?: string;

  getEnum(): HeaderArquivoStatusEnum {
    return this.id;
  }
}
