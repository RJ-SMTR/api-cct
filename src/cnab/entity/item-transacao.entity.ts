import { EntityHelper} from 'src/utils/entity-helper';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ItemTransacao extends EntityHelper {
  @PrimaryGeneratedColumn()
  id_item_transacao: number;

  @Column({ type: String, unique: false, nullable: true })
  dt_transacao: string;
  @Column({ type: String, unique: false, nullable: true })
  dt_processamento: string;
  @Column({ type: Date, unique: false, nullable: true })
  dt_captura: Date; 
  @Column({ type: String, unique: false, nullable: true })
  modo: string;
  @Column({ type: String, unique: false, nullable: true })
  id_cliente_favorecido: number;
}