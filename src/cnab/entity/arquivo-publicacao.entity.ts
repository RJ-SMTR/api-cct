import { EntityHelper } from 'src/utils/entity-helper';
import {
  asNullableStringOrNumber
} from 'src/utils/pipe-utils';
import {
  AfterLoad,
  Column,
  CreateDateColumn,
  DeepPartial,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ItemTransacao } from './pagamento/item-transacao.entity';
import { isSameDay } from 'date-fns';

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
  @OneToOne(() => ItemTransacao, { nullable: true, eager: true })
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

  /** Remessa CNAB. Sexta-feira de pagamento. */
  @Column({ type: String, unique: false, nullable: true })
  dataVencimento: Date | null;

  /** Remessa CNAB. Data em que o retorno foi feito e efetuado o pagamento. */
  @Column({ type: String, unique: false, nullable: true })
  dataEfetivacao: Date | null;

  /** Retorno CNAB. Detalhe A */
  @Column({ type: 'numeric', unique: false, nullable: true })
  valorRealEfetivado: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @AfterLoad()
  setReadValues() {
    this.valorRealEfetivado = asNullableStringOrNumber(this.valorRealEfetivado);
  }

  /** Evita acessar o itemTransacao.DetalheA.Ocorrencia para saber se teve erro. */
  getIsError() {
    return !this.isPago && this.dataEfetivacao;
  }

  public static filterUnique(
    publicacoes: ArquivoPublicacao[],
    compare: ArquivoPublicacao,
  ) {
    return publicacoes.filter(
      (p) =>
        p.itemTransacao.idConsorcio === compare.itemTransacao.idConsorcio &&
        p.itemTransacao.idOperadora === compare.itemTransacao.idOperadora &&
        isSameDay(p.itemTransacao.dataOrdem, compare.itemTransacao.dataOrdem),
    );
  }

  public static getUniqueUpdatePublicacoes(publicacoes: ArquivoPublicacao[]) {
    const unique: ArquivoPublicacao[] = [];
    publicacoes.forEach((publicacao) => {
      const existing = ArquivoPublicacao.filterUnique(unique, publicacao)[0] as
        | ArquivoPublicacao
        | undefined;
      const ocourences = ArquivoPublicacao.filterUnique(
        publicacoes,
        publicacao,
      ).sort(
        (a, b) =>
          b.itemTransacao.dataOrdem.getTime() -
          a.itemTransacao.dataOrdem.getTime(),
      );
      const paid = ocourences.filter((i) => i.isPago)[0] as
        | ArquivoPublicacao
        | undefined;
      const noErrors = ocourences.filter((i) => !i.getIsError())[0] as
        | ArquivoPublicacao
        | undefined;
      const recent = ocourences[0] as ArquivoPublicacao;
      if (!existing) {
        const newPublicacao = paid || noErrors || recent;
        unique.push(newPublicacao);
      }
    });
    return unique;
  }
}
