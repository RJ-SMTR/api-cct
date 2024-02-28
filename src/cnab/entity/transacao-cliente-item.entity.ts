import { EntityHelper } from 'src/utils/entity-helper';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class TransacaoClienteItem extends EntityHelper {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: Number, unique: false, nullable: true, length: 150 })
  id_item_transacao: number;

  @Column({ type: Number, unique: false, nullable: true, length: 150 })
  id_cliente_favorecido: number;

  public getLogInfo(): string {
    const response =
      `#${this.id}` + `, itemTransacao: '${this.id_item_transacao}'`;
    +`, clienteFavorecido: '${this.id_cliente_favorecido}'`;
    return response;
  }
}
