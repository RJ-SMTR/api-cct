import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { ClienteFavorecido } from 'src/domain/entity/cliente-favorecido.entity';
import { ItemTransacao } from 'src/domain/entity/item-transacao.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { AfterLoad, BeforeInsert, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LancamentoStatus } from '../enum/lancamento-status.enum';
import { LancamentoAutorizacaoHistory } from './lancamento-autorizacao-history.entity';
import { asStringOrNumber } from 'src/utils/pipe-utils';
import { Lancamento, ILancamentoBase } from './lancamento.entity';
import { User } from './user.entity';

export type TLancamentoHistory = {
  lancamento: Lancamento;
  backupAt: Date;
} & ILancamentoBase;

/** Lancamento ao devolver a request */
export type TLancamentoHistoryOutput = {
  autorizado_por: {
    /** user.id */
    id: number;
    nome: string;
    data_autorizacao: Date;
  }[];
} & TLancamentoHistory;

@Entity('lancamento_history')
export class LancamentoHistory extends EntityHelper implements TLancamentoHistory {
  constructor(lancamento?: DeepPartial<LancamentoHistory>) {
    super();
    if (lancamento !== undefined) {
      Object.assign(this, lancamento);
    }
  }

  public static fromLancamento(l: Lancamento, setAutorizacoes: boolean) {
    return new LancamentoHistory({
      lancamento: { id: l.id },
      valor: l.valor,
      data_ordem: l.data_ordem,
      data_pgto: l.data_pgto,
      data_lancamento: l.data_lancamento,
      itemTransacao: l.itemTransacao,
      ...(setAutorizacoes ? { autorizacoes: l.autorizacoes } : {}),
      autor: l.autor,
      clienteFavorecido: { id: l.clienteFavorecido.id },
      algoritmo: l.algoritmo,
      glosa: l.glosa,
      recurso: l.recurso,
      anexo: l.anexo,
      numero_processo: l.numero_processo,
      is_autorizado: l.is_autorizado,
      is_pago: l.is_pago,
      status: l.status,
      motivo_cancelamento: l.motivo_cancelamento,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    });
  }

  @Expose()
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_LancamentoHistory_id' })
  id: number;

  @Expose()
  @ManyToOne(() => Lancamento, { nullable: false, eager: false, onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoHistory_lancamento_ManyToOne' })
  lancamento: Lancamento;

  @ApiProperty({ description: 'Valor a pagar' })
  @Column({ type: 'numeric' })
  valor: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_ordem: Date;

  /** Data da ordem baseada no valor da dataOrdem no front */
  @Column({ type: 'timestamp', nullable: true })
  data_pgto: Date | null;

  /**
   * Data usada meramente para registro, baseado na seleção dos parâmetros no front.
   *
   * Mesmo se a dataOrdem for alterada a dataLancamento permanece igual.
   *
   * @examples
   * - Mês: agosto, período: 1, ano: 2024 = 2024/08/01
   * - Mês: agosto, período: 2, ano: 2024 = 2024/08/16
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_lancamento: Date;

  /**
   * Geração de Remessa
   *
   * uniqueConstraintName: `UQ_LancamentoHistory_itemTransacao`
   */
  @Exclude()
  @ApiProperty({ description: 'ItemTransação do CNAB remessa associado a este Lançamento' })
  @OneToOne(() => ItemTransacao, { nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoHistory_itemTransacao_OneToOne' })
  @Transform(({ value }) => (!value ? null : ((it = value as ItemTransacao) => ({ id: it.id, itemTransacaoAgrupado: { id: it.itemTransacaoAgrupado.id } }))()))
  itemTransacao: ItemTransacao | null;

  @ManyToMany(() => User, (user) => user)
  @JoinTable({
    name: 'lancamento_autorizacao_history',
    joinColumn: { name: 'lancamentoHistoryId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
    synchronize: false, // We use LancamentoAutorizacaoHistory to generate migration
  })
  @Exclude()
  autorizacoes: User[];

  /** Coluna virtual, para consulta completa */
  @OneToMany(() => LancamentoAutorizacaoHistory, (lah) => lah.lancamentoHistory)
  @JoinColumn()
  @Expose({ name: 'autorizado_por' })
  @Transform(({ value }) => (value as LancamentoAutorizacaoHistory[]).map((lah) => ({ id: lah.user.id, nome: lah.user.fullName, data_autorizacao: lah.createdAt })))
  _autorizacoes: LancamentoAutorizacaoHistory[];

  /** O autor mais recente da criação/modificação/autorização do Lançamento */
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoHistory_autor_ManyToOne' })
  @Transform(({ value }) => ({ id: (value as User).id, fullName: (value as User).fullName } as DeepPartial<User>))
  autor: User;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({ name: 'id_cliente_favorecido', foreignKeyConstraintName: 'FK_LancamentoHistory_idClienteFavorecido_ManyToOne' })
  @Transform(({ value }) => ({
    id: (value as ClienteFavorecido).id,
    nome: (value as ClienteFavorecido).nome,
  }))
  clienteFavorecido: ClienteFavorecido;

  @Column({ type: 'numeric', nullable: false })
  algoritmo: number;

  @Column({ type: 'numeric', nullable: false, default: 0 })
  glosa: number;

  @Column({ type: 'numeric', nullable: false, default: 0 })
  recurso: number;

  @Column({ type: 'numeric', nullable: false, default: 0 })
  anexo: number;

  @Column({ type: String, nullable: false })
  numero_processo: string;

  /** Quando 2 pessoas autorizam, o Lançamento está autorizado, pronto para enviar o remessa */
  @Column({ type: Boolean, nullable: false, default: false })
  is_autorizado: boolean;

  @Column({ type: Boolean, nullable: false, default: false })
  is_pago: boolean;

  /** Uma forma de rastrear o estado atual do Lancamento */
  @Column({ enum: LancamentoStatus, nullable: false })
  status: LancamentoStatus;

  @Column({ type: String, nullable: true })
  motivo_cancelamento: string | null;

  /** Lancamento.createdAt */
  @Column({ type: Date, nullable: false })
  createdAt: Date;

  /** Lancamento.updatedAt */
  @Column({ type: Date, nullable: false })
  updatedAt: Date;

  /** Data de criação deste histórico */
  @CreateDateColumn()
  backupAt: Date;

  @BeforeInsert()
  setWriteValues() {
    if (!this.status) {
      this.status = LancamentoStatus._1_gerado;
    }
  }

  @AfterLoad()
  setReadValues() {
    this.glosa = asStringOrNumber(this.glosa);
    this.algoritmo = asStringOrNumber(this.algoritmo);
    this.recurso = asStringOrNumber(this.recurso);
    this.anexo = asStringOrNumber(this.anexo);
    this.valor = asStringOrNumber(this.valor);
    this.autorizacoes = this._autorizacoes.map((lah) => lah.user);
  }

  public static getSqlFields(table?: string, castType?: boolean): Record<keyof TLancamentoHistory, string> {
    return {
      id: `${table ? `${table}.` : ''}"id"`,
      lancamento: `${table ? `${table}.` : ''}"lancamentoId"`,
      valor: `${table ? `${table}.` : ''}"valor"`, // number,
      data_ordem: `${table ? `${table}.` : ''}"data_ordem"`, // Date,
      data_pgto: `${table ? `${table}.` : ''}"data_pgto"`, // Date | null,
      data_lancamento: `${table ? `${table}.` : ''}"data_lancamento"`, // Date,
      itemTransacao: `${table ? `${table}.` : ''}"itemTransacao"`, // ItemTransacao,
      autorizacoes: `${table ? `${table}.` : ''}"autorizacoes"`, // User[],
      autor: `${table ? `${table}.` : ''}"autor"`, // User,
      clienteFavorecido: `${table ? `${table}.` : ''}"clienteFavorecido"`, // ClienteFavorecido,
      algoritmo: `${table ? `${table}.` : ''}"algoritmo"`, // number,
      glosa: `${table ? `${table}.` : ''}"glosa"`, // number,
      recurso: `${table ? `${table}.` : ''}"recurso"`, // number,
      anexo: `${table ? `${table}.` : ''}"anexo"`, // number,
      numero_processo: `${table ? `${table}.` : ''}"numero_processo"`, // string,
      is_autorizado: `${table ? `${table}.` : ''}"is_autorizado"`, // boolean,
      is_pago: `${table ? `${table}.` : ''}"is_pago"`, // boolean,
      status: `${table ? `${table}.` : ''}"status"`, // string,
      motivo_cancelamento: `${table ? `${table}.` : ''}"motivo_cancelamento"`, // string,
      createdAt: `${table ? `${table}.` : ''}"createdAt"`, // Date,
      updatedAt: `${table ? `${table}.` : ''}"updatedAt"`, // Date,
      backupAt: `${table ? `${table}.` : ''}"backupAt"`, // Date,
    };
  }

  public static sqlFieldTypes: Record<keyof TLancamentoHistory, string> = {
    id: 'INT',
    lancamento: 'INT',
    valor: 'NUMERIC',
    data_ordem: 'TIMESTAMP',
    data_pgto: 'TIMESTAMP',
    data_lancamento: 'TIMESTAMP',
    itemTransacao: 'INT',
    autorizacoes: '',
    autor: '',
    clienteFavorecido: '',
    algoritmo: 'NUMERIC',
    glosa: 'NUMERIC',
    recurso: 'NUMERIC',
    anexo: 'NUMERIC',
    numero_processo: 'VARCHAR',
    is_pago: 'BOOLEAN',
    is_autorizado: 'BOOLEAN',
    status: 'VARCHAR',
    motivo_cancelamento: 'VARCHAR',
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
    backupAt: 'TIMESTAMP',
  };
}
