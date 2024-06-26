import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import {
  AfterLoad,
  Column,
  CreateDateColumn,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ItfLancamento } from './interfaces/lancamento.interface';
import { asStringOrNumber } from 'src/utils/pipe-utils';

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
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_Lancamento_user_ManyToOne',
  })
  user: User;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({
    name: 'id_cliente_favorecido',
    foreignKeyConstraintName: 'FK_Lancamento_idClienteFavorecido_ManyToOne',
  })
  id_cliente_favorecido: ClienteFavorecido;

  @Column({ type: 'varchar', nullable: false })
  algoritmo: string;

  @Column({ type: 'numeric', nullable: false })
  glosa: number;

  @Column({ type: 'numeric', nullable: false })
  recurso: number;

  @Column({ type: 'numeric', nullable: false })
  anexo: number;

  @Column({ type: 'numeric', nullable: false })
  valor_a_pagar: number;

  @Column({ type: 'varchar', nullable: false })
  numero_processo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  toItfLancamento(): ItfLancamento {
    return {
      id: this.id,
      descricao: this.descricao,
      valor: this.valor,
      data_ordem: this.data_ordem,
      data_pgto: this.data_pgto,
      data_lancamento: this.data_lancamento,
      algoritmo: this.algoritmo,
      glosa: this.glosa,
      recurso: this.recurso,
      anexo: this.anexo,
      valor_a_pagar: this.valor_a_pagar,
      numero_processo: this.numero_processo,
      id_cliente_favorecido: this.id_cliente_favorecido,
      auth_usersIds: this.auth_usersIds?.split(',')?.map(Number) || [],
      autorizadopor: [],
    };
  }

  @AfterLoad()
  setReadValues() {
    this.glosa = asStringOrNumber(this.glosa);
    this.recurso = asStringOrNumber(this.recurso);
    this.anexo = asStringOrNumber(this.anexo);
    this.valor_a_pagar = asStringOrNumber(this.valor_a_pagar);
  }
}
