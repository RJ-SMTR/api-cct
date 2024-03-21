import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClienteFavorecido } from './cliente-favorecido.entity';
import { Transacao } from './transacao.entity';
import { DetalheA } from './detalhe-a.entity';
import { ItemTransacaoStatus } from './item-transacao-status.entity';

@Entity()
export class ItemTransacao extends EntityHelper {

  constructor(dto?: DeepPartial<ItemTransacao>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Transacao, {
    eager: true,
  })
  transacao: Transacao;

  @Column({ type: Date, unique: false, nullable: false })
  dataTransacao: Date;

  @CreateDateColumn()
  dataProcessamento: Date;

  @CreateDateColumn()
  dataCaptura: Date;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeConsorcio: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeOperadora: string | null;

  @ManyToOne(() => ClienteFavorecido, {
    eager: true, nullable: true
  })
  clienteFavorecido: ClienteFavorecido | null;

  /**
   * Monetary value
   */
  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 5,
  })
  valor: number | null;

  // Unique columns combination

  @Column({ type: String, unique: false, nullable: false })
  idOrdemPagamento: string;

  /** Veículo */
  @Column({ type: String, unique: false, nullable: false })
  servico: string;

  /** CPF. */
  @Column({ type: String, unique: false, nullable: false })
  idOperadora: string;

  /** CNPJ */
  @Column({ type: String, unique: false, nullable: false })
  idConsorcio: string;
  
  /** FK to know which DetalheA is related to ItemTransacao */
  @OneToOne(() => DetalheA, { eager: false, nullable: true })
  @JoinColumn()
  detalheA: DetalheA | null;
  
  /** DataOrdem from bigquery */
  @Column({ type: Date, unique: false, nullable: false })
  dataOrdem: Date;
  
  @CreateDateColumn()
  createdAt: Date;
  
  @UpdateDateColumn()
  updatedAt: Date;
  
  @Column({ type: String, unique: false, nullable: false })
  versaoOrdemPagamento: string;

  @ManyToOne(() => ItemTransacaoStatus, { eager: false, nullable: false })
  status: ItemTransacaoStatus;

  public getLogInfo(): string {
    return `#{ idOP: ${this.idOrdemPagamento}, svc: ${this.servico}, `
      + `op: ${this.idOperadora}, co: ${this.idConsorcio} }`;
  }
}