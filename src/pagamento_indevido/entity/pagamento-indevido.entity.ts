import { ApiProperty } from "@nestjs/swagger";
import { Exclude } from "class-transformer/types/decorators/exclude.decorator";
import { EntityHelper } from "src/utils/entity-helper";
import { Entity,  PrimaryColumn, DeepPartial, Column } from "typeorm";

@Entity()
export class PagamentoIndevido extends EntityHelper {
  constructor(pagamentoIndevido?: DeepPartial<PagamentoIndevido>) {
    super();
    if (pagamentoIndevido !== undefined) {
      Object.assign(this, pagamentoIndevido);
    }
  }
  
  @Exclude()
  @ApiProperty({ example: 1 })
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_PagamentoIndevido_id' })
  id: number;
 
  @Column({ type: Date, unique: false, nullable: false })
  dataPagamento: Date;

  @Column({ type: Date, unique: false, nullable: false })
  dataReferencia: Date;

  @Column({ type: String, unique: false, nullable: false, length: 150 })
  nomeFavorecido: string;

  @Column({ type: Number, unique: false, nullable: false })
  valorPago:number;

  @Column({ type: Number, unique: false, nullable: false })
  valorDebitar:number;	
}
