import { EntityHelper } from 'src/utils/entity-helper';
import {
  AfterLoad,
  Column,
  CreateDateColumn,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClienteFavorecido } from '../cliente-favorecido.entity';
import { Transacao } from './transacao.entity';
import { DetalheA } from './detalhe-a.entity';
import { ItemTransacaoStatus } from './item-transacao-status.entity';
import { asStringOrNumber } from 'src/utils/pipe-utils';

@Entity()
export class ItemTransacao extends EntityHelper {
  constructor(dto?: DeepPartial<ItemTransacao>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_ItemTransacao_id' })
  id: number;

  @ManyToOne(() => Transacao, {
    eager: true,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_ItemTransacao_transacao_ManyToOne',
  })
  transacao: Transacao;

  @CreateDateColumn()
  dataProcessamento: Date;

  @CreateDateColumn()
  dataCaptura: Date;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeConsorcio: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeOperadora: string | null;

  /** If entity exists, create, if not, go standby and check later. */
  @ManyToOne(() => ClienteFavorecido, {
    eager: true,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_ItemTransacao_clienteFavorecido_ManyToOne',
  })
  clienteFavorecido: ClienteFavorecido;

  /**
   * Valor do lançamento.
   */
  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 5,
  })
  valor: number;

  // Unique columns Jaé

  @Column({ type: String, unique: false, nullable: true })
  idOrdemPagamento: string | null;

  /** CPF. */
  @Column({ type: String, unique: false, nullable: true })
  idOperadora: string | null;

  /** CNPJ */
  @Column({ type: String, unique: false, nullable: true })
  idConsorcio: string | null;

  // Unique columns Lancamento

  /** Lancamento.data_lancamento */
  @Column({ type: Date, unique: false, nullable: true })
  dataLancamento: Date | null;

  /** FK to know which DetalheA is related to ItemTransacao */
  @OneToOne(() => DetalheA, { eager: true, nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_ItemTransacao_detalheA_OneToOne',
  })
  detalheA: DetalheA | null;

  /** DataOrdem from bigquery */
  @Column({ type: Date, unique: false, nullable: false })
  dataOrdem: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => ItemTransacaoStatus, { eager: false, nullable: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ItemTransacao_status_ManyToOne' })
  status: ItemTransacaoStatus;

  public getLogInfo(): string {
    return `#{ idOP: ${this.idOrdemPagamento}, op: ${this.idOperadora}, co: ${this.idConsorcio} }`;
  }

  public static getUniqueIdJae(entity: DeepPartial<ItemTransacao>): string {
    return `${entity.idOrdemPagamento}|${entity.idConsorcio}|${entity.idOperadora}`;
  }

  public static getUniqueIdLancamento(
    entity: DeepPartial<ItemTransacao>,
  ): string {
    const dataLancamento = entity.dataLancamento;
    if (dataLancamento === null || dataLancamento === undefined) {
      return String(dataLancamento);
    } else {
      return (dataLancamento as Date).toISOString();
    }
  }

  @AfterLoad()
  setReadValues() {
    this.valor = asStringOrNumber(this.valor);
  }
}
