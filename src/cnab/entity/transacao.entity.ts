import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pagador } from './pagador.entity';

@Entity()
export class Transacao extends EntityHelper {
  constructor(transacao?: Transacao | DeepPartial<Transacao>) {
    super();
    if (transacao !== undefined) {
      Object.assign(this, transacao);
    }
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: Date, unique: false, nullable: true })
  dataOrdem: Date | null;

  @Column({ type: Date, unique: false, nullable: true })
  dataPagamento: Date | null;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeConsorcio: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeOperadora: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 150 })
  servico: string | null;

  @Column({ type: Number, unique: false, })
  idOrdemPagamento: number | null;

  @Column({ type: String, unique: false, nullable: true, length: 150 })
  idOrdemRessarcimento: string | null;

  @Column({ type: Number, unique: false, nullable: true })
  quantidadeTransacaoRateioCredito: number | null;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  valorRateioCredito: number;

  @Column({ type: Number, unique: false, nullable: true })
  quantidadeTransacaoRateioDebito: number | null;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  valorRateioDebito: number | null;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  quantidadeTotalTransacao: number | null;

  @Column({ type: Number, unique: false, nullable: true })
  valorTotalTransacaoBruto: number | null;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  valorDescontoTaxa: number | null;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  valorTotalTransacaoLiquido: number | null;

  @Column({ type: Number, unique: false, nullable: true })
  quantidadeTotalTransacaoCaptura: number | null;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  valorTotalTransacaoCaptura: number | null;

  @Column({ type: Boolean, unique: false, nullable: true })
  indicadorOrdemValida: boolean | null;

  @ManyToOne(() => Pagador, { eager: true })
  pagador: Pagador;

  @CreateDateColumn()
  createdAt: Date;

  public getLogInfo(): string {
    const response = `#${this.id}`;
    return response;
  }
}
