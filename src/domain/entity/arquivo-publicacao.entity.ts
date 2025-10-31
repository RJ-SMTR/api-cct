import { isSameDay } from 'date-fns';
import { EntityHelper } from 'src/utils/entity-helper';
import { asNullableStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ItemTransacao } from './item-transacao.entity';

export interface IArquivoPublicacao {
  id: number;
  itemTransacao: ItemTransacao;
  isPago: boolean;
  dataGeracaoRetorno: Date | null;
  dataVencimento: Date | null;
  dataEfetivacao: Date | null;
  valorRealEfetivado: number | null;
  createdAt: Date;
  updatedAt: Date;
}
/**
 * Representa uma transação de uma ordem de pagamento (idOrdem) a um destinatário específico (idOperadora)
 * Unique Jaé FK: idOrdemPagamento, idConsorcio, idOperadora
 */
@Entity()
export class ArquivoPublicacao extends EntityHelper implements IArquivoPublicacao {
  constructor(arquivoPublicacao: DeepPartial<ArquivoPublicacao>) {
    super();
    if (arquivoPublicacao !== undefined) {
      Object.assign(this, arquivoPublicacao);
      if (arquivoPublicacao.itemTransacao) {
        arquivoPublicacao.itemTransacao = new ItemTransacao(arquivoPublicacao.itemTransacao);
      }
    }
  }

  public static sqlFieldTypes: Record<keyof IArquivoPublicacao, string> = {
    id: 'INT',
    itemTransacao: 'INT',
    isPago: 'BOOLEAN',
    dataGeracaoRetorno: 'TIMESTAMP',
    dataVencimento: 'TIMESTAMP',
    dataEfetivacao: 'TIMESTAMP',
    valorRealEfetivado: 'NUMERIC',
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  };

  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_ArquivoPublicacao_id',
  })
  id: number;

  /** Remessa */
  @OneToOne(() => ItemTransacao, { nullable: true, eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_ArquivoPublicacao_itemTransacao_OneToOne',
  })
  itemTransacao: ItemTransacao;

  /** Retorno */
  @Column({ type: Boolean, unique: false, nullable: false })
  isPago: boolean;

  /** Retorno - dataHora geração retorno */
  @Column({ type: Date, unique: false, nullable: true })
  dataGeracaoRetorno: Date | null;

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

  public static filterUnique(publicacoes: ArquivoPublicacao[], compare: ArquivoPublicacao) {
    return publicacoes.filter((p) => p.itemTransacao.idConsorcio === compare.itemTransacao.idConsorcio && p.itemTransacao.idOperadora === compare.itemTransacao.idOperadora && isSameDay(p.itemTransacao.dataOrdem, compare.itemTransacao.dataOrdem));
  }

  public static getUniqueUpdatePublicacoes(publicacoes: ArquivoPublicacao[]) {
    const unique: ArquivoPublicacao[] = [];
    publicacoes.forEach((publicacao) => {
      const existing = ArquivoPublicacao.filterUnique(unique, publicacao)[0] as ArquivoPublicacao | undefined;
      const ocourences = ArquivoPublicacao.filterUnique(publicacoes, publicacao).sort((a, b) => b.itemTransacao.dataOrdem.getTime() - a.itemTransacao.dataOrdem.getTime());
      const paid = ocourences.filter((i) => i.isPago)[0] as ArquivoPublicacao | undefined;
      const noErrors = ocourences.filter((i) => !i.getIsError())[0] as ArquivoPublicacao | undefined;
      const recent = ocourences[0] as ArquivoPublicacao;
      if (!existing) {
        const newPublicacao = paid || noErrors || recent;
        unique.push(newPublicacao);
      }
    });
    return unique;
  }
}
