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
  nome_consorcio: string;
  @Column({ type: Number, unique: false, nullable: true })
  id_tipo_pagamento: number;
  @Column({ type: String, unique: false, nullable: true })
  tipo_transacao: string;
  @Column({ type: Number, unique: false, nullable: true })
  valor_item_transacao: number;
  @Column({ type: String, unique: false, nullable: true })
  id_transacao: number;
  @Column({ type: String, unique: false, nullable: true })
  id_cliente_transacao: number;
}