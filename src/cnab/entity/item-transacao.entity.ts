import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClienteFavorecido } from './cliente-favorecido.entity';
import { Transacao } from './transacao.entity';

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

  @Column({ type: Date, unique: false, nullable: true })
  dataProcessamento: Date | null;

  @Column({ type: Date, unique: false, nullable: true })
  dataCaptura: Date | null;

  @Column({ type: String, unique: false, nullable: true, length: 10 })
  modo: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeConsorcio: string | null;

  @ManyToOne(() => ClienteFavorecido, {
    eager: true
  })
  clienteFavorecido: ClienteFavorecido;

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

}