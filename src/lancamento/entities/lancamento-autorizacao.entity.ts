import { Expose } from 'class-transformer';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { CreateDateColumn, DeepPartial, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Lancamento } from './lancamento.entity';

export interface ILancamentoAutorizacao {
  id: number;
  lancamento: Lancamento;
  user: User;
  createdAt: Date;
  updatedAt: Date;
}

@Entity('lancamento_autorizacao')
export class LancamentoAutorizacao extends EntityHelper implements ILancamentoAutorizacao {
  constructor(autorizado?: DeepPartial<LancamentoAutorizacao>) {
    super();
    if (autorizado !== undefined) {
      Object.assign(this, autorizado);
    }
  }

  public static tableName = 'lancamento_autorizacao';

  public static sqlFields: Record<keyof ILancamentoAutorizacao, string> = {
    id: `"id"`,
    lancamento: `"lancamentoId"`,
    user: `"userId"`,
    createdAt: `"createdAt"`,
    updatedAt: `"updatedAt"`,
  };

  @Expose()
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_LancamentoAutorizacao_id' })
  id: number;

  @ManyToOne(() => Lancamento, (lancamento) => lancamento.autorizacoes, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoAutorizacao_lancamento' })
  @Index('IDX_LancamentoAutorizacao_lancamento')
  lancamento: Lancamento;

  @ManyToOne(() => User, (user) => user.lancamentos, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoAutorizacao_user' })
  @Index('IDX_LancamentoAutorizacao_user')
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
