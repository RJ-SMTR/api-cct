import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DetalheBDTO } from '../dto/detalhe-b.dto';
import { DetalheA } from './detalhe-a.entity';

/**
 * Pagamento.DetalheB
 */
@Entity()
export class DetalheB extends EntityHelper {
  constructor(detalheB?: DetalheB | DeepPartial<DetalheB> | DetalheBDTO) {
    super();
    if (detalheB !== undefined) {
      Object.assign(this, detalheB);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_DetalheB_id' })
  id: number;

  @OneToOne(() => DetalheA, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheB_detalheA_OneToOne' })
  detalheA: DetalheA;

  /**
   * Número Sequencial do Registro.
   * 
   * Detalhe unique ID per lote
   */
  @Column({ type: Number, unique: false, nullable: false })
  nsr: number;

  @Column({ type: Date, unique: false, nullable: false })
  dataVencimento: Date;

  @CreateDateColumn()
  createdAt: Date;

  public getLogInfo(): string {
    const response = `#${this.id}`;
    return response;
  }
}
