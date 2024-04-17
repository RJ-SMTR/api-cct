import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import {
  Column,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity('lancamento')
export class LancamentoEntity extends EntityHelper {

  constructor(lancamento?: DeepPartial<LancamentoEntity>) {
    super();
    if (lancamento !== undefined) {
      Object.assign(this, lancamento);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Lancamento_id' })
  id: number;

  @Column({ type: 'varchar' })
  descricao: string;

  /** Valor pago */
  @Column({ type: 'numeric' })
  valor: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_ordem: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_pgto: Date;

  /** createdAt */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_lancamento: Date;

  /** Remessa */
  @ManyToOne(() => Transacao, { nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Lancamento_transacao_ManyToOne' })
  transacao: Transacao;

  /** @example `1,2,3` */
  @Column({ type: 'varchar', nullable: true })
  auth_usersIds?: string;

  @Column({ type: 'int', nullable: false })
  userId?: number;

  /** Is userId the same as user? Why do we have two of them?  */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_Lancamento_user_ManyToOne' })
  user: User;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({
    name: 'id_cliente_favorecido',
    foreignKeyConstraintName: 'FK_Lancamento_idClienteFavorecido_ManyToOne'
  })
  id_cliente_favorecido: ClienteFavorecido;

  @Column({ type: 'int', nullable: false })
  algoritmo: number;

  @Column({ type: 'int', nullable: false })
  glosa: number;

  @Column({ type: 'int', nullable: false })
  recurso: number;

  @Column({ type: 'int', nullable: false })
  valor_a_pagar: number;

  @Column({ type: 'int', nullable: false })
  numero_processo: number;
}
