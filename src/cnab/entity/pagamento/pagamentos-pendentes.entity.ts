import { EntityHelper } from 'src/utils/entity-helper';
import {  
  Column,
  DeepPartial,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class PagamentosPendentes extends EntityHelper {
  constructor(pagamentosPendentes?: DeepPartial<PagamentosPendentes>) {
    super();
    if (pagamentosPendentes !== undefined) {
      Object.assign(this, pagamentosPendentes);
    }
  }

  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_Pagamentos_Pendentes_id',
  })
  id: number;  

  @Column({type: String, unique: false, nullable: true})
  nomeFavorecido: string;

  @Column({type: 'decimal', unique: false, nullable: true, precision: 13, scale: 2})
  valorLancamento: number;
  
  @Column({ type: Date, unique: false, nullable: true })
  dataReferencia: Date;

  @Column({ type: Date, unique: false, nullable: true })
  dataVencimento: Date;

  @Column({ type: String, unique: false, nullable: true })
  numeroDocumento: string;

  @Column({ type: String, unique: false, nullable: true })
  ocorrenciaErro: string;

}