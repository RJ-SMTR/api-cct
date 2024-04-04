import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Transacao } from './transacao.entity';

@Entity()
export class TransacaoOcorrencia extends EntityHelper {
  constructor(
    clienteFavorecido?: DeepPartial<TransacaoOcorrencia>,
  ) {
    super();
    if (clienteFavorecido !== undefined) {
      Object.assign(this, clienteFavorecido);
    }
  }
  
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Ocorrencia_id' })
  id: number;
  
  @ManyToOne(() => Transacao)
  @JoinColumn({ foreignKeyConstraintName: 'FK_TransacaoOcorrencia_transacao_ManyToOne' })
  transacao: Transacao;
  
  /** uniqueConstraintName: UQ_TransacaoOcorrencia_code */
  @Column({ type: String, unique: true, nullable: false, length: 2 })
  code: string;

  @Column({ type: String, unique: false, nullable: false, length: 100 })
  message: string;
}
