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
import { ItemTransacaoAgrupado } from './item-transacao-agrupado.entity';
import { Transacao } from './transacao.entity';

/**
 * Representa uma BqOrdemPgto (ArquivoPublicacao)
 * 
 * Colunas:
 * - dataOrdem: BqOrdemPgto.dataOrdem
 * 
 * Identificador:
 * - ItemTransacaoAgrupado
 * - dataTransacao
 * - dataProcessamento
 * - clienteFavorecido
 */
@Entity()
export class ItemTransacao extends EntityHelper {
  constructor(dto?: DeepPartial<ItemTransacao>) {
    super();
    if (dto) {
      Object.assign(this, dto);
      if (dto.itemTransacaoAgrupado) {
        this.itemTransacaoAgrupado = new ItemTransacaoAgrupado(dto.itemTransacaoAgrupado)
      }
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

  @ManyToOne(() => ItemTransacaoAgrupado, {
    eager: true,
  })
  @JoinColumn({
    foreignKeyConstraintName:
      'FK_ItemTransacao_itemTransacaoAgrupado_ManyToOne',
  })
  itemTransacaoAgrupado: ItemTransacaoAgrupado;

  @CreateDateColumn()
  dataProcessamento: Date;

  /**
   * Data em que o Bigquery obteve o dado e salvou no banco deles.
   *
   * Como o Bigquery.dataCaptura foi removido, estamos salvando dataCaptura = dataOrdem apenas por conveniência.
   */
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

  /** 
   * DataOrdem from bigquery
   * 
   * D+1 (sex-qui)
   */
  @Column({ type: Date, unique: false, nullable: false })
  dataOrdem: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public getLogInfo(): string {
    return `#{ idOP: ${this.idOrdemPagamento}, op: ${this.idOperadora}, co: ${this.idConsorcio} }`;
  }

  public static getUniqueIdJae(entity: DeepPartial<ItemTransacao>): string {
    return `${entity.idOrdemPagamento}|${entity.idConsorcio}|${entity.idOperadora}`;
  }

  @AfterLoad()
  setReadValues() {
    this.valor = asStringOrNumber(this.valor);
  }
}
