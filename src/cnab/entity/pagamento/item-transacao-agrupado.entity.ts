import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrNumber } from 'src/utils/pipe-utils';
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
  UpdateDateColumn
} from 'typeorm';
import { ClienteFavorecido } from '../cliente-favorecido.entity';
import { DetalheA } from './detalhe-a.entity';
import { ItemTransacaoStatus } from './item-transacao-status.entity';
import { TransacaoAgrupado } from './transacao-agrupado.entity';

@Entity()
export class ItemTransacaoAgrupado extends EntityHelper {
  constructor(dto?: DeepPartial<ItemTransacaoAgrupado>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_ItemTransacaoAgrupado_id',
  })
  id: number;

  @ManyToOne(() => TransacaoAgrupado, {
    eager: true,
  })
  @JoinColumn({
    foreignKeyConstraintName:
      'FK_ItemTransacaoAgrupado_transacaoAgrupado_ManyToOne',
  })
  transacaoAgrupado: TransacaoAgrupado;

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
    foreignKeyConstraintName:
      'FK_ItemTransacaoAgrupado_clienteFavorecido_ManyToOne',
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
    foreignKeyConstraintName: 'FK_ItemTransacaoAgrupado_detalheA_OneToOne',
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
  @JoinColumn({
    foreignKeyConstraintName: 'FK_ItemTransacaoAgrupado_status_ManyToOne',
  })
  status: ItemTransacaoStatus;

  public getLogInfo(): string {
    return `#{ idOP: ${this.idOrdemPagamento}, op: ${this.idOperadora}, co: ${this.idConsorcio} }`;
  }

  public static getUniqueIdJae(
    entity: DeepPartial<ItemTransacaoAgrupado>,
  ): string {
    return `${entity.idOrdemPagamento}|${entity.idConsorcio}|${entity.idOperadora}`;
  }

  public static getUniqueIdLancamento(
    entity: DeepPartial<ItemTransacaoAgrupado>,
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
