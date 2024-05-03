/**
  // Remessa
  idTransacao: idTransacao,
  itemTransacao: { id: idItemTransacao },
  // Retorno
  isPago: false,
  dataGeracaoRetorno: null,
  horaGeracaoRetorno: null,
  dataVencimento: friday,
  valorLancamento: null,
  dataEfetivacao: null,
  valorRealEfetivado: null,
 */

import { EntityHelper } from 'src/utils/entity-helper';
import {
  Column,
  DeepPartial,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { ItemTransacao } from './pagamento/item-transacao.entity';

/**
 * Unique Jaé FK: idOrdemPagamento, idConsorcio, idOperadora
 */
@Entity()
export class ArquivoPublicacao extends EntityHelper {
  constructor(arquivoPublicacao: DeepPartial<ArquivoPublicacao>) {
    super();
    if (arquivoPublicacao !== undefined) {
      Object.assign(this, arquivoPublicacao);
    }
  }
  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_ArquivoPublicacao_id',
  })
  id: number;

  /** Remessa */
  @Column({ type: Number, unique: false, nullable: false })
  idTransacao: number;

  /** Remessa */
  @OneToOne(() => ItemTransacao, { nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_ArquivoPublicacao_itemTransacao_OneToOne',
  })
  itemTransacao: ItemTransacao;

  /** Retorno */
  @Column({ type: Boolean, unique: false, nullable: false })
  isPago: boolean;

  /** Retorno */
  @Column({ type: Date, unique: false, nullable: true })
  dataGeracaoRetorno: Date | null;

  /** Retorno */
  @Column({ type: Date, unique: false, nullable: true })
  horaGeracaoRetorno: Date | null;

  /** Remessa CNAB. Friday week day (friday) */
  @Column({ type: String, unique: false, nullable: true })
  dataVencimento: Date | null;

  /** Retorno CNAB. Payment retorno date */
  @Column({ type: String, unique: false, nullable: true })
  dataEfetivacao: Date | null;

  /** Retorno CNAB. Detalhe A */
  @Column({ type: String, unique: false, nullable: true })
  valorRealEfetivado: number | null;

}
