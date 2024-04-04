import { EntityHelper } from 'src/utils/entity-helper';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
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
  @JoinColumn({ foreignKeyConstraintName: 'FK_ItemTransacao_transacao_ManyToOne' })
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
    eager: true
  })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ItemTransacao_clienteFavorecido_ManyToOne' })
  clienteFavorecido: ClienteFavorecido;
  
  /** If no clienteFavorecido, use this static value to find if FK can be created. */
  @Column({ type: String, unique: false, nullable: false })
  favorecidoCpfCnpj: string;

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

  // Unique columns combination

  @Column({ type: String, unique: false, nullable: false })
  idOrdemPagamento: string;

  /** CPF. */
  @Column({ type: String, unique: false, nullable: false })
  idOperadora: string;

  /** CNPJ */
  @Column({ type: String, unique: false, nullable: false })
  idConsorcio: string;

  /** FK to know which DetalheA is related to ItemTransacao */
  @OneToOne(() => DetalheA, { eager: false, nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ItemTransacao_detalheA_OneToOne' })
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
  

  @AfterLoad()
  setFieldValues() {
    this.valor = asStringOrNumber(this.valor);
  }
}