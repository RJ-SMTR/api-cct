import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DetalheBDTO } from '../dto/detalhe-b.dto';

@Entity()
export class DetalheB extends EntityHelper {
  constructor(detalheB?: DetalheB | DeepPartial<DetalheB> | DetalheBDTO) {
    super();
    if (detalheB !== undefined) {
      Object.assign(this, detalheB);
    }
  }

  @PrimaryGeneratedColumn()
  id_detalhe_b: number;
  
  id_detalhe_a: number;

  @Column({ type: Number, unique: false, nullable: false })
  nsr: number;
  
  @Column({ type: Date, unique: false, nullable: false })
  data_vencimento: Date;

  public getLogInfo(): string {
    const response = `#${this.id_detalhe_b}`;
    return response;
  }
}
