import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DetalheBDTO } from '../../dto/pagamento/detalhe-b.dto';
import { DetalheAConf } from './detalhe-a-conf.entity';


/**
 * Pagamento.DetalheB
 */
@Entity()
export class DetalheBConf extends EntityHelper {
  constructor(detalheB?: DetalheBConf | DeepPartial<DetalheBConf> | DetalheBDTO) {
    super();
    if (detalheB !== undefined) {
      Object.assign(this, detalheB);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_DetalheBConf_id' })
  id: number;

  @OneToOne(() => DetalheAConf, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheBConf_detalheA_OneToOne' })
  detalheA: DetalheAConf;

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
