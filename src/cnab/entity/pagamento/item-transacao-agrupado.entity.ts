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
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClienteFavorecido } from '../cliente-favorecido.entity';
import { TransacaoAgrupado } from './transacao-agrupado.entity';

/**
 * Representa um destinatário, a ser pago pelo remetente (TransacaoAgrupado).
 * 
 * Esta tabela contém a soma de todas as transações (ItemTransacao)
 * a serem feitas neste CNAB (TransacaoAgrupado).
 * 
 * Colunas:
 * - dataOrdem: sexta de pagamento (baseado no BigqueryOrdemPgto.dataOrdem (dia da ordem D+1))
 * 
 * Identificador:
 *   - TransacaoAgrupado (CNAB / remetente)
 *   - ClienteFavorecido (destinatário)
 */
@Entity()
export class ItemTransacaoAgrupado extends EntityHelper {
  constructor(dto?: DeepPartial<ItemTransacaoAgrupado>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  private readonly FKs = ['transacaoAgrupado', 'clienteFavorecido'];

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
    precision: 13,
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

  /** Data em que será feito o apgamento. (também vem do bigquery) */
  @Column({ type: Date, unique: false, nullable: false })
  dataOrdem: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public getLogInfo(): string {
    return `#{ idOP: ${this.idOrdemPagamento}, op: ${this.idOperadora}, co: ${this.idConsorcio} }`;
  }

  public static getUniqueIdJae(
    entity: DeepPartial<ItemTransacaoAgrupado>,
  ): string {
    return `${entity.idOrdemPagamento}|${entity.idConsorcio}|${entity.idOperadora}`;
  }

  @AfterLoad()
  setReadValues() {
    this.valor = asStringOrNumber(this.valor);
  }
}
