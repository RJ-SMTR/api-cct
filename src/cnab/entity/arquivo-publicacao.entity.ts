import { EntityHelper } from 'src/utils/entity-helper';
import {
  AfterLoad,
  Column,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HeaderArquivo } from './pagamento/header-arquivo.entity';
import { Transacao } from './pagamento/transacao.entity';
import { asStringNumber } from 'src/utils/pipe-utils';

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
  @ManyToOne(() => HeaderArquivo, { nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_ArquivoPublicacao_headerArquivo_ManyToOne',
  })
  headerArquivo: HeaderArquivo | null;

  /** Remessa */
  @ManyToOne(() => Transacao, { nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_ArquivoPublicacao_transacao_ManyToOne',
  })
  transacao: Transacao;

  /** Remessa */
  @Column({ type: String, unique: false, nullable: true })
  idHeaderLote: number | null;

  /** Remessa */
  @Column({ type: Date, unique: false, nullable: true })
  dataGeracaoRemessa: Date | null;

  /** Remessa */
  @Column({ type: Date, unique: false, nullable: true })
  horaGeracaoRemessa: Date | null;

  /** Retorno */
  @Column({ type: Boolean, unique: false, nullable: false })
  isPago: boolean;

  /** Retorno */
  @Column({ type: Date, unique: false, nullable: true })
  dataGeracaoRetorno: Date | null;

  /** Retorno */
  @Column({ type: Date, unique: false, nullable: true })
  horaGeracaoRetorno: Date | null;

  /** DetalheA retorno */
  @Column({ type: Number, unique: false, nullable: true })
  loteServico: number | null;

  /** DetalheA retorno */
  @Column({ type: String, unique: false, nullable: false })
  nomePagador: string;

  /** DetalheA retorno */
  @Column({ type: String, unique: false, nullable: false })
  agenciaPagador: string;

  /** DetalheA retorno */
  @Column({ type: String, unique: false, nullable: false })
  dvAgenciaPagador: string;

  /** DetalheA retorno */
  @Column({ type: String, unique: false, nullable: false })
  contaPagador: string;

  /** DetalheA retorno */
  @Column({ type: String, unique: false, nullable: false })
  dvContaPagador: string;

  /** Favorecido */
  @Column({ type: String, unique: false, nullable: false })
  nomeCliente: string;

  /** Favorecido */
  @Column({ type: String, unique: false, nullable: false })
  cpfCnpjCliente: string;

  /** Favorecido */
  @Column({ type: String, unique: false, nullable: false })
  codigoBancoCliente: string;

  /** Favorecido */
  @Column({ type: String, unique: false, nullable: false })
  agenciaCliente: string;

  /** Favorecido */
  @Column({ type: String, unique: false, nullable: false })
  dvAgenciaCliente: string;

  /** Favorecido */
  @Column({ type: String, unique: false, nullable: false })
  contaCorrenteCliente: string;

  /** Favorecido */
  @Column({ type: String, unique: false, nullable: false })
  dvContaCorrenteCliente: string;

  /** Remessa CNAB. Friday week day (friday) */
  @Column({ type: String, unique: false, nullable: true })
  dataVencimento: Date | null;

  /** Retorno CNAB. */
  @Column({
    type: 'numeric',
    unique: false,
    nullable: true,
    precision: 13,
    scale: 2,
  })
  valorLancamento: number | null;

  /** Retorno CNAB. Payment retorno date */
  @Column({ type: String, unique: false, nullable: true })
  dataEfetivacao: Date | null;

  /** Retorno CNAB. */
  @Column({ type: String, unique: false, nullable: true })
  valorRealEfetivado: number | null;

  /** Retorno CNAB. */
  @Column({ type: Number, unique: false, nullable: true })
  idDetalheARetorno: number | null;

  /** OrdemPagamento */
  @Column({ type: String, unique: false, nullable: false })
  idOrdemPagamento: string;

  /**
   * OrdemPagamento
   *
   * Id from cadastro.consorcios
   *
   * id_consorcio.cnpj = CNPJ
   */
  @Column({ type: String, unique: false, nullable: false })
  idConsorcio: string;

  /**
   * OrdemPagamento
   *
   * Operadora id from cadastro.operadoras
   *
   * id_operadora.documento = CPF
   */
  @Column({ type: String, unique: false, nullable: false })
  idOperadora: string;

  /** OrdemPagamento */
  @Column({ type: Date, unique: false, nullable: false })
  dataOrdem: Date;

  /** OrdemPagamento */
  @Column({ type: String, unique: false, nullable: false })
  nomeConsorcio: string;

  /** OrdemPagamento */
  @Column({ type: String, unique: false, nullable: false })
  nomeOperadora: string;

  /** OrdemPagamento */
  @Column({
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 2,
  })
  valorTotalTransacaoLiquido: number;

  @AfterLoad()
  setReadValues() {
    if (typeof this.valorTotalTransacaoLiquido === 'string') {
      this.valorTotalTransacaoLiquido = asStringNumber(
        this.valorTotalTransacaoLiquido,
      );
    }
    if (typeof this.valorLancamento === 'string') {
      this.valorLancamento = asStringNumber(this.valorLancamento);
    }
  }
}
