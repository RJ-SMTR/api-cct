import { EntityHelper } from 'src/utils/entity-helper';
import { asNullableStringOrNumber, asStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { HeaderLote } from './header-lote.entity';
import { ItemTransacaoAgrupado } from './item-transacao-agrupado.entity';
import { Ocorrencia } from './ocorrencia.entity';
import { isAfter } from 'date-fns';
import { getDateFromCnabName } from 'src/utils/date-utils';
import { OrdemPagamentoAgrupadoHistorico } from 'src/novo-remessa/entity/ordem-pagamento-agrupado-historico.entity';
import { Nullable } from 'src/utils/types/nullable.type';

/**
 * Pagamento.DetalheA
 */
@Entity()
export class DetalheA extends EntityHelper {
  constructor(detalheA?: DeepPartial<DetalheA>) {
    super();
    if (detalheA) {
      Object.assign(this, detalheA); 
      if (detalheA.ordemPagamentoAgrupadoHistorico) {
        detalheA.ordemPagamentoAgrupadoHistorico = new OrdemPagamentoAgrupadoHistorico(detalheA.ordemPagamentoAgrupadoHistorico);
      }
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_DetalheA_id' })
  id: number;

  @ManyToOne(() => HeaderLote, { eager: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheA_headerLote_ManyToOne' })
  headerLote: HeaderLote;

  @OneToMany(() => Ocorrencia, (ocorrencia) => ocorrencia.detalheA, {
    eager: true,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheA_ocorrencias_OneToMany',
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
  @OneToOne(() => ItemTransacaoAgrupado, { eager: false, nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheA_itemTransacaoAgrupado_OneToOne',
  })
  itemTransacaoAgrupado: ItemTransacaoAgrupado;

  @OneToOne(() => OrdemPagamentoAgrupadoHistorico, { eager: true, nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheA_OrdemPagamentoAgrupadoHistorico_OneToOne',
  })
  ordemPagamentoAgrupadoHistorico: OrdemPagamentoAgrupadoHistorico | Nullable<OrdemPagamentoAgrupadoHistorico>;

  /** Nome do retorno mais recente lido, para referência. */
  @Column({ type: String, unique: false, nullable: true })
  retornoName: string | null;

  /**
   * Verifica a data-hora do retorno mais recente, para evitar ler um retorno mais antigo que o atual (regra de negócio)
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

  isPago() {
    const errors = Ocorrencia.getErrorCodesFromString(this.ocorrenciasCnab || '');
    return errors.length === 0 && Boolean(this.ocorrenciasCnab?.length);
  }

  /** Se o retorno atual do DetalheA tiver a data-hora MENOR que o novo retorno */
  hasOlderRetorno(retornoName: string) {
    const newRetornoDate = getDateFromCnabName(retornoName);
    const currentRetornoDate = this.retornoDatetime || new Date(0);
    return isAfter(newRetornoDate, currentRetornoDate);
  }

  /**
   * ID: headerLoteUniqueId + detalheA columns
   */
  public static getUniqueId(detalheA: DeepPartial<DetalheA>, headerLoteUniqueId?: string): string {
    const _headerLoteUniqueId = headerLoteUniqueId ? `(${headerLoteUniqueId})` : `(${HeaderLote.getUniqueId(detalheA?.headerLote)})`;
    return `${_headerLoteUniqueId}|${detalheA.nsr}`;
  }

  public static getOcorrenciaErrors(detalhes: DetalheA[]) {
    return detalhes.reduce((l, i) => [...l, ...i.ocorrencias.filter((j) => !['00', 'BD'].includes(j.code))], []);
  }

  public static getItemTransacaoAgIds(detalhesA: DetalheA[]) {
    return [...new Set(detalhesA.map((i) => i.itemTransacaoAgrupado.id))];
  }
}
