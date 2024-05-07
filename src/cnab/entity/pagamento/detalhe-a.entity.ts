import { EntityHelper } from 'src/utils/entity-helper';
import {
  asNullableStringOrNumber,
  asStringOrNumber,
} from 'src/utils/pipe-utils';
import {
  AfterLoad,
  Column,
  CreateDateColumn,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClienteFavorecido } from '../cliente-favorecido.entity';
import { HeaderLote } from './header-lote.entity';
import { Ocorrencia } from './ocorrencia.entity';
import { ItemTransacaoAgrupado } from './item-transacao-agrupado.entity';
import { ItemTransacao } from './item-transacao.entity';

/**
 * Pagamento.DetalheA
 */
@Entity()
export class DetalheA extends EntityHelper {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_DetalheA_id' })
  id: number;

  @ManyToOne(() => HeaderLote, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheA_headerLote_ManyToOne' })
  headerLote: HeaderLote;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheA_clienteFavorecido_ManyToOne',
  })
  clienteFavorecido: ClienteFavorecido;

  @OneToMany(() => Ocorrencia, (ocorrencia) => ocorrencia.detalheA, {
    eager: true,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheA_ocorrencias_OneToMany',
  })
  ocorrencias: Ocorrencia[];

  @Column({ type: String, unique: false, nullable: true, length: 10 })
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

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => ItemTransacaoAgrupado, { eager: false, nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheA_itemTransacaoAgrupado_OneToOne',
  })
  itemTransacaoAgrupado: ItemTransacaoAgrupado | null;

  @OneToOne(() => ItemTransacaoAgrupado, { eager: false, nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheA_itemTransacao_OneToOne',
  })
  itemTransacao: ItemTransacao | null;

  getOcorrenciasCnab() {
    return (this.ocorrenciasCnab || '').trim();
  }

  @AfterLoad()
  setReadValues() {
    this.quantidadeMoeda = asNullableStringOrNumber(this.quantidadeMoeda);
    this.valorLancamento = asStringOrNumber(this.valorLancamento);
    this.valorRealEfetivado = asStringOrNumber(this.valorRealEfetivado);
  }

  /**
   * ID: headerLoteUniqueId + detalheA columns
   */
  public static getUniqueId(
    detalheA: DeepPartial<DetalheA>,
    headerLoteUniqueId?: string,
  ): string {
    const _headerLoteUniqueId = headerLoteUniqueId
      ? `(${headerLoteUniqueId})`
      : `(${HeaderLote.getUniqueId(detalheA?.headerLote)})`;
    return `${_headerLoteUniqueId}|${detalheA.nsr}`;
  }
}
