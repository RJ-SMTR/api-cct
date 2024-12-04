import { EntityHelper } from 'src/utils/entity-helper';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrdemPagamento } from './ordem-pagamento.entity';
import { asNullableStringOrNumber, asStringOrNumber } from 'src/utils/pipe-utils';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';

@Entity()
export class OrdemPagamentoAgrupado extends EntityHelper {
  constructor(dto?: DeepPartial<OrdemPagamentoAgrupado>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_OrdemPagamentoAgrupadoId' })
  id: number;

  @Column({ type: String, unique: false, nullable: false })
  userId: number;

  @Column({ type: String, unique: false, nullable: false })
  userBankCode: string;

  @Column({ type: String, unique: false, nullable: false })
  userBankAgency: string;

  @Column({ type: String, unique: false, nullable: false })
  userBankAccount: string;

  @Column({ type: String, unique: false, nullable: false })
  userBankAccountDigit: string;

  /**
   * Data em que o pagamento agrupado foi gerado no CCT. Inclui data-hora para sabermos o momento exato da geração.
   * É o mesmo que createdAt, para simplificação.
   */
  @CreateDateColumn()
  dataPagamento: Date;

  /**
   * Valor da soma das Ordens.
   * Se não houver valores a somar, o total deve ser `0.00`, nunca `null` - para simplificação.
   */
  @Column({
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valorTotal: number;

  @OneToMany(() => OrdemPagamento, (op) => op.ordemPgamentoAgrupado, { eager: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_OrdemPagamentoAgrupado_ordensPagamento_OneToMany' })
  ordensPagamento: OrdemPagamento[];

  /** Gerado, Enviado, Cancelado */
  @Column({ enum: StatusRemessaEnum, unique: false, nullable: false })
  statusRemessa: StatusRemessaEnum;

  /** Pago, Não Pago */
  @Column({ type: Boolean, unique: false, nullable: false })
  isPago: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @AfterLoad()
  setReadValues() {
    this.valorTotal = asStringOrNumber(this.valorTotal);
  }
}
