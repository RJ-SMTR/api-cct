import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DetalheBDTO } from '../dto/detalhe-b.dto';
import { DetalheA } from './detalhe-a.entity';

@Entity()
export class DetalheB extends EntityHelper {
  constructor(detalheB?: DetalheB | DeepPartial<DetalheB> | DetalheBDTO) {
    super();
    if (detalheB !== undefined) {
      Object.assign(this, detalheB);
    }
  }

  @PrimaryGeneratedColumn()
  id: number;
  
  @OneToOne(() => DetalheA, { eager: true })
  @JoinColumn()
  detalheA: DetalheA;

  @Column({ type: Number, unique: false, nullable: false })
  nsr: number;
  
  @Column({ type: Date, unique: false, nullable: false })
  dataVencimento: Date;

  public getLogInfo(): string {
    const response = `#${this.id}`;
    return response;
  }
}
