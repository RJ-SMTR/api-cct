import { EntityHelper } from 'src/utils/entity-helper';
import { asNullableStringOrNumber, asStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClienteFavorecido } from '../cliente-favorecido.entity';
import { HeaderLoteConf } from './header-lote-conf.entity';
import { Ocorrencia } from '../pagamento/ocorrencia.entity';
import { ItemTransacaoAgrupado } from '../pagamento/item-transacao-agrupado.entity';

/**
 * Pagamento.DetalheA
 */
@Entity()
export class DetalheAConf extends EntityHelper {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_DetalheAConf_id' })
  id: number;

  @ManyToOne(() => HeaderLoteConf, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheAConf_headerLote_ManyToOne',
  })
  headerLote: HeaderLoteConf;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheAConf_clienteFavorecido_ManyToOne',
  })
  clienteFavorecido: ClienteFavorecido;

  @OneToMany(() => Ocorrencia, (ocorrencia) => ocorrencia.detalheA, {
    eager: true,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheAConf_ocorrencias_OneToMany',
  })
  ocorrencias: Ocorrencia[];

  @Column({ type: String, unique: false, nullable: true, length: 30 })
  ocorrenciasCnab: string | null;

  @Column({ type: Number, unique: false, nullable: true })
  loteServico: number;

  @Column({ type: String, unique: false, nullable: true })
  finalidadeDOC: string | null;

  /** Atribuído pela empresa, sequencial */
  @Column({ type: Number, unique: false, nullable: false })
  numeroDocumentoEmpresa: number;

  @Column({ type: Date, unique: false, nullable: true })
  dataVencimento: Date;

  @Column({ type: String, unique: false, nullable: true })
  tipoMoeda: string | null;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 10,
    scale: 5,
  })
  quantidadeMoeda: number | null;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 13,
    scale: 2,
  })
  valorLancamento: number;

  @Column({ type: String, unique: false, nullable: true })
  numeroDocumentoBanco: string | null;

  @Column({ type: Number, unique: false, nullable: true })
  quantidadeParcelas: number | null;

  @Column({ type: String, unique: false, nullable: true })
  indicadorBloqueio: string | null;

  @Column({ type: String, unique: false, nullable: true })
  indicadorFormaParcelamento: string | null;

  @Column({ type: Date, unique: false, nullable: true })
  periodoVencimento: Date | null;

  @Column({ type: Number, unique: false, nullable: true })
  numeroParcela: number | null;

  @Column({ type: Date, unique: false, nullable: true })
  dataEfetivacao: Date | null;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 13,
    scale: 2,
  })
  valorRealEfetivado: number;

  /**
   * Número Sequencial do Registro.
   *
   * Detalhe unique ID per lote
   */
  @Column({ type: Number, unique: false, nullable: false })
  nsr: number;

  /** `UQ_DetalheA_itemTransacaoAgrupado` */
  @OneToOne(() => ItemTransacaoAgrupado, { eager: true, nullable: false })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheAConf_itemTransacaoAgrupado_OneToOne',
  })
  itemTransacaoAgrupado: ItemTransacaoAgrupado;

  /** Nome do retorno mais recente lido, para referência. */
  @Column({ type: String, unique: false, nullable: true })
  retornoName: string | null;

  /**
   * Verifica a data-hora do último retorno, para evitar ler um retorno mais antigo que o atual (regra de negócio)
   *
   * É a data-hora descrita no retornoName
   */
  @Column({ type: Date, unique: false, nullable: true })
  retornoDatetime: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  getOcorrenciasCnab() {
    return (this.ocorrenciasCnab || '').trim();
  }

  @AfterLoad()
  setReadValues() {
    this.quantidadeMoeda = asNullableStringOrNumber(this.quantidadeMoeda);
    this.valorLancamento = asStringOrNumber(this.valorLancamento);
    this.valorRealEfetivado = asStringOrNumber(this.valorRealEfetivado);
  }

  public isPago() {
    const errors = Ocorrencia.getErrorCodesFromString(this.ocorrenciasCnab || '');
    return errors.length === 0;
  }

  public static getOcorrenciaErrors(detalhes: DetalheAConf[]) {
    return detalhes.reduce((l, i) => [...l, ...i.ocorrencias.filter((j) => !['00', 'BD'].includes(j.code))], []);
  }

  public static getItemTransacaoAgIds(detalhesA: DetalheAConf[]) {
    return [...new Set(detalhesA.map((i) => i.itemTransacaoAgrupado.id))];
  }

  public static getTransacaoAgIds(detalhesA: DetalheAConf[]): number[] {
    return [...new Set(detalhesA.map((i) => i.itemTransacaoAgrupado.transacaoAgrupado.id))];
  }
}
