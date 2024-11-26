import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrdemPagamentoAgrupadoEntity } from './ordem-pagamento-agrupado.entity';

@Entity()
export class OrdemPagamentoEntity extends EntityHelper {
  constructor(dto?: DeepPartial<OrdemPagamentoEntity>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Ordem_Pagamento_id' })
  id: number;

  @Column({ type: String, unique: false, nullable: false })
  dataOrdem: String;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeConsorcio: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeOperadora: string | null;

  @Column({ type: String, unique: false, nullable: false })
  userId?: number;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 13,
    scale: 5,
  })
  valor: number;

  @Column({ type: String, unique: false, nullable: true })
  idOrdemPagamento: string | null;

  /** CPF. */
  @Column({ type: String, unique: false, nullable: true })
  idOperadora: string | null;

  /** CNPJ */
  @Column({ type: String, unique: false, nullable: true })
  idConsorcio: string | null;

  @ManyToOne(() => OrdemPagamentoAgrupadoEntity, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_OrdemPagamentoAgrupado_ManyToOne' })
  ordemPgamentoAgrupado: OrdemPagamentoAgrupadoEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
