import { EntityHelper } from 'src/utils/entity-helper';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { Transacao } from './transacao.entity';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { HttpStatus } from 'aws-sdk/clients/lambda';

@Entity()
export class ItemTransacao extends EntityHelper {

  constructor(dto?: ItemTransacaoDTO) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn()
  id_item_transacao: number;

  @ManyToOne(() => Transacao, {
    eager: true
  })
  transacao: Transacao;

  @Column({ type: String, unique: false, nullable: true })
  dt_transacao: string;

  @Column({ type: Date, unique: false, nullable: true })
  dt_processamento: Date;
  
  @Column({ type: Date, unique: false, nullable: true })
  dt_captura: Date;
  
  @Column({ type: String, unique: false, nullable: true })
  modo: string;
  
  @Column({ type: String, unique: false, nullable: true })
  id_cliente_favorecido: number;
  
  @Column({ type: Number, unique: false, nullable: true })
  valor_item_transacao: number;


  /**
   * Get field validated
   * @throws `HttpException`
   */
  getDtTransacao(args?: {
    errorMessage?: string;
    httpStatusCode?: HttpStatus;
  }): string {
    if (!this.dt_transacao) {
      throw CommonHttpException.invalidField(
        'ItemTransacao',
        'dt_transacao',
        args);
    }
    return this.dt_transacao;
  }
  
}