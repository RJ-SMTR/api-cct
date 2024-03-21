import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExtratoHeaderLote } from './extrato-header-lote.entity';

/**
 * @see {@link https://cmsarquivos.febraban.org.br/Arquivos/documentos/PDF/Layout%20padrao%20CNAB240%20V%2010%2011%20-%2021_08_2023.pdf FEBRABAN}
 */
@Entity()
export class ExtratoDetalheE extends EntityHelper {


  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_ExtratoDetalheE_id' })
  id: number;

  @ManyToOne(() => ExtratoHeaderLote, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ExtratoDetalheE_extratoHeaderLote_ManyToOne' })
  extratoHeaderLote: ExtratoHeaderLote;

  @Column({ type: Number, unique: false, nullable: false })
  loteServico: number;

  /** Empresa */
  @Column({ type: Number, unique: false, nullable: false })
  tipoInscricao: number;

  /** Empresa. Numeric string, because its a code despite being a number */
  @Column({ type: String, unique: false, nullable: false })
  numeroInscricao: string;

  /** Empresa */
  @Column({ type: String, unique: false, nullable: false })
  codigoConvenioBanco: string;

  /** Empresa. Agência Mantenedora da Conta*/
  @Column({ type: String, unique: false, nullable: false })
  agencia: string;

  /** Empresa */
  @Column({ type: String, unique: false, nullable: false })
  dvAgencia: string;

  /** Empresa. Número da Conta Corrente*/
  @Column({ type: String, unique: false, nullable: false })
  conta: string;

  /** Empresa */
  @Column({ type: String, unique: false, nullable: false })
  dvConta: string;

  /** Empresa */
  @Column({ type: String, unique: false, nullable: false })
  dvAgenciaConta: string;

  /** Empresa */
  @Column({ type: String, unique: false, nullable: false })
  nomeEmpresa: string;

  @Column({ type: String, unique: false, nullable: false })
  naturezaLancamento: string;

  @Column({ type: String, unique: false, nullable: false })
  tipoComplementoLancamento: string;

  @Column({ type: String, unique: false, nullable: false })
  complementoLancamento: string;

  @Column({ type: String, unique: false, nullable: false })
  isencaoCpmf: string;

  /** Data de efetivação do Lançamento */
  @Column({ type: Date, unique: false, nullable: false })
  dataContabil: string;

  /** Data de ocorrência dos fatos, itens, componentes do extrato bancário */
  @Column({ type: Date, unique: false, nullable: false })
  dataLancamento: Date;

  @Column({
    type: 'decimal', unique: false, nullable: true,
    precision: 5,
    scale: 2,
  })
  valorLancamento: number;

  @Column({ type: String, unique: false, nullable: false })
  tipoLancamento: string;

  @Column({ type: String, unique: false, nullable: false })
  categoriaLancamento: string;

  @Column({ type: String, unique: false, nullable: false })
  codigoHistoricoBanco: string;

  @Column({ type: String, unique: false, nullable: false })
  descricaoHistoricoBanco: string;

  /** 
   * Número Documento / Complemento
   * 
   * Número que identifica o documento que gerou o Lançamento.
   */
  @Column({ type: String, unique: false, nullable: false })
  numeroDocumento: string;

  @CreateDateColumn()
  createdAt: Date;

  /**
   * For some reason, fields like 'time', 'decimal'
   * are received as string instead as Date, Number.
   */
  @AfterLoad()
  castFields() {
    this.valorLancamento = asStringOrNumber(this.valorLancamento);
  }
}
