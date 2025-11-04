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

  @PrimaryColumn({ primaryKeyConstraintName: 'PK_PagamentoIndevido_id' })
  id: number;
 
  @Column({ type: Date, unique: false, nullable: true })
  dataPagamento: Date;

  @Column({ type: Date, unique: false, nullable: true })
  dataReferencia: Date;

  @Column({ type: String, unique: false, nullable: false, length: 150 })
  nomeFavorecido: string;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 5,
  })
  valorPago:number;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 5,
  })
  valorPagar:number;	

  
  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 5,
  })
  saldoDevedor:number;	
}
