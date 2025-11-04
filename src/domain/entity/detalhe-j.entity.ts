/**
 * TODO: renomear de entity0 para entity, permitindo gerar migrations
 */
import { Cnab104CodigoMovimento } from 'src/configuration/cnab/enums/104/cnab-104-codigo-movimento.enum';
import { EntityHelper } from 'src/utils/entity-helper';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { HeaderLote } from './header-lote.entity';
import { Cnab104CodigoMoedaOperacao, Cnab104CodigoMoedaTipo } from 'src/configuration/cnab/enums/104/cnab-104-codigo-moeda.enum';

/**
 * Pagamento.DetalheJ
 */
@Entity()
export class DetalheJ extends EntityHelper {
  constructor(dto?: DeepPartial<DetalheJ>) {
    super();
    if (dto !== undefined) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_DetalheB_id' })
  id: number;

  @OneToOne(() => HeaderLote, { eager: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheJ_headerLote_OneToOne' })
  headerLote: HeaderLote;

  /** Número Sequencial do Registro */
  @Column({ type: Number, unique: false, nullable: false })
  nsr: number;

  @Column({ enum: Cnab104CodigoMovimento, unique: false, nullable: false })
  codigoMovimento: Cnab104CodigoMovimento;

  /**
   * J.08 - Banco destino - preencher com o código do banco de destino do boleto,
   * conforme constante da 1a a 3a posições na barra da cobrança
   * ou com zeros para pagamento de Pix QR Code. Retornado conforme recebido
   */
  @Column({ enum: Cnab104CodigoMovimento, unique: false, nullable: false })
  bancoDestino: Cnab104CodigoMovimento;

  /**
   * J.09 - Código Moeda - preencher com o código da moeda conforme constante da 4a posição
   * na barra da cobrança ou com zero para pagamento de Pix QR Code
   */
  @Column({ enum: Cnab104CodigoMoedaOperacao, unique: false, nullable: false })
  codigoMoedaOperacao: Cnab104CodigoMoedaOperacao;

  @Column({ type: String, unique: false, nullable: false, length: 1 })
  dvCodigobarras: string;

  @Column({ type: String, unique: false, nullable: false })
  fatorVencimento: string;

  /**
   * J.12 - Valor do Documento - Preencher conforme constante da 10a a 19a posições
   * da barra da cobrança ou com zeros para pagamento de Pix QR Code. Retornado conforme recebido.
   */
  @Column({ type: 'decimal', unique: false, nullable: false, precision: 8, scale: 2 })
  valorDocumento: number;

  @Column({ type: String, unique: false, nullable: false })
  nomeCedente: string;

  @Column({ type: 'date', unique: false, nullable: false })
  dataVencimento: Date;

  @Column({ type: 'decimal', unique: false, nullable: false, precision: 8, scale: 2 })
  valorTitulo: number;

  @Column({ type: 'decimal', unique: false, nullable: false, precision: 8, scale: 2 })
  valorDescontoAbatimento: number;

  @Column({ type: 'decimal', unique: false, nullable: false, precision: 8, scale: 2 })
  valorMoraMulta: number;

  @Column({ type: 'date', unique: false, nullable: false })
  dataPagamento: Date;

  @Column({ type: 'decimal', unique: false, nullable: false, precision: 13, scale: 2 })
  valorPagamento: number;

  @Column({ type: 'decimal', unique: false, nullable: false, precision: 10, scale: 5 })
  quantidadeMoeda: number;

  @Column({ type: String, unique: false, nullable: false })
  numeroDocumentoEmpresa: string;

  @Column({ enum: Cnab104CodigoMoedaTipo, unique: false, nullable: false })
  codigoMoedaTipo: Cnab104CodigoMoedaTipo;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @AfterLoad()
  setReadValues(): void {
    this.valorDocumento = +this.valorDocumento;
    this.valorTitulo = +this.valorTitulo;
    this.valorTitulo = +this.valorTitulo;
    this.valorDescontoAbatimento = +this.valorDescontoAbatimento;
    this.valorMoraMulta = +this.valorMoraMulta;
    this.valorPagamento = +this.valorPagamento;
    this.quantidadeMoeda = +this.quantidadeMoeda;
  }
}
