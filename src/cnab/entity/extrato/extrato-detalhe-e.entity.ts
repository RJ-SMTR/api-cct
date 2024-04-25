import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExtratoHeaderLote } from './extrato-header-lote.entity';

/**
 * Represents Detalhe Segmento E v030
 * 
 * Composite PK: extratoHeaderLote, loteServico, nsr
 * 
 * @see {@link https://www.caixa.gov.br/Downloads/extrato-eletronico-conciliacao-bancaria/Manual_de_Leiaute_CNAB_240_Extrato_Eletronico_Para_Conciliacao_Bancaria.pdf Caixa, page 10}
 */
@Entity()
export class ExtratoDetalheE extends EntityHelper {

  constructor(dto?: DeepPartial<ExtratoDetalheE>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_ExtratoDetalheE_id' })
  id: number;

  @ManyToOne(() => ExtratoHeaderLote, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ExtratoDetalheE_extratoHeaderLote_ManyToOne' })
  extratoHeaderLote: ExtratoHeaderLote;

  /**
   * Current lote number in Cnab File
   */
  @Column({ type: Number, unique: false, nullable: false })
  loteServico: number;

  /**
   * Número Sequencial do Registro (no lote).
   * 
   * Current registro number in Cnab Lote
   */
  @Column({ type: Number, unique: false, nullable: false })
  nsr: number;


  /** Empresa */
  @Column({ type: String, unique: false, nullable: false })
  tipoInscricao: string;

  /** Empresa. CPF/CNPJ */
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

  /** Data de ocorrência dos fatos, itens, componentes do extrato bancário */
  @Column({ type: Date, unique: false, nullable: false })
  dataLancamento: Date;

  @Column({
    type: 'decimal', unique: false, nullable: true,
    precision: 16,
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
   * TODO: Is this field "Número Documento atribuído pela Empresa" (unique id per date)?
   */
  @Column({ type: String, unique: false, nullable: false })
  numeroDocumento: string;

  @CreateDateColumn()
  createdAt: Date;

  @AfterLoad()
  setFieldValues() {
    this.valorLancamento = asStringOrNumber(this.valorLancamento);
  }
}
