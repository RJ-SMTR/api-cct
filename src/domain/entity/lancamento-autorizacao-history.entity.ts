import { Expose } from 'class-transformer';
import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LancamentoHistory } from './lancamento-history.entity';
import { LancamentoAutorizacao } from './lancamento-autorizacao.entity';
import { User } from './user.entity';

export interface ILancamentoAutorizacaoHistory {
  id: number;
  /** LancamentoAutorizacao.lancamento */
  lancamentoHistory: LancamentoHistory;
  user: User;
  /** LancamentoAutorizacao.createdAt */
  createdAt: Date;
  /** LancamentoAutorizacao.updatedAt */
  updatedAt: Date;
}

@Entity('lancamento_autorizacao_history')
export class LancamentoAutorizacaoHistory extends EntityHelper implements ILancamentoAutorizacaoHistory {
  constructor(autorizado?: DeepPartial<LancamentoAutorizacaoHistory>) {
    super();
    if (autorizado !== undefined) {
      Object.assign(this, autorizado);
    }
  }

  static fromLancamentoAutorizacao(lancamentoAutorizacao: LancamentoAutorizacao, lancamentoHistory: LancamentoHistory) {
    return new LancamentoAutorizacaoHistory({
      lancamentoHistory: { id: lancamentoHistory.id },
      user: lancamentoAutorizacao.user,
      createdAt: lancamentoAutorizacao.createdAt,
      updatedAt: lancamentoAutorizacao.updatedAt,
    });
  }

  @Expose()
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_LancamentoAutorizacaoHistory_id' })
  id: number;

  /** LancamentoAutorizacao.lancamento */
  @ManyToOne(() => LancamentoHistory, (lancamentoHistory) => lancamentoHistory.autorizacoes, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoAutorizacaoHistory_lancamento' })
  @Index('IDX_LancamentoAutorizacaoHistory_lancamento')
  lancamentoHistory: LancamentoHistory;

  @ManyToOne(() => User, (user) => user.lancamentos, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoAutorizacaoHistory_user' })
  @Index('IDX_LancamentoAutorizacaoHistory_user')
  user: User;

  /** LancamentoAutorizacao.createdAt */
  @Column({ type: Date, nullable: false })
  createdAt: Date;

  /** LancamentoAutorizacao.updatedAt */
  @Column({ type: Date, nullable: false })
  updatedAt: Date;

  /** Data de criação deste histórico */
  @CreateDateColumn()
  backupAt: Date;

  public static tableName = 'lancamento_autorizacao_history';

  public static sqlFields: Record<keyof ILancamentoAutorizacaoHistory, string> = {
    id: `"id"`,
    lancamentoHistory: `"lancamentoHistory"`,
    user: `"userId"`,
    createdAt: `"createdAt"`,
    updatedAt: `"updatedAt"`,
  };
}
