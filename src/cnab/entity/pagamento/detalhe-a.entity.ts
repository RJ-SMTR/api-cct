import { EntityHelper } from 'src/utils/entity-helper';
import { asNullableStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClienteFavorecido } from '../cliente-favorecido.entity';
import { HeaderLote } from './header-lote.entity';

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
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheA_clienteFavorecido_ManyToOne' })
  clienteFavorecido: ClienteFavorecido;

  @Column({ type: Number, unique: false, nullable: true })
  loteServico: number | null;

  @Column({ type: String, unique: false, nullable: true })
  finalidadeDOC: string | null;

  /** Atribuído pela empresa, sequencial */
  @Column({ type: Number, unique: false, nullable: false })
  numeroDocumentoEmpresa: number;

  @Column({ type: Date, unique: false, nullable: true })
  dataVencimento: Date | null;

  @Column({ type: String, unique: false, nullable: true })
  tipoMoeda: string | null;

  @Column({
    type: 'decimal', unique: false, nullable: true,
    precision: 5,
    scale: 10,
  })
  quantidadeMoeda: number | null;

  @Column({
    type: 'decimal', unique: false, nullable: true,
    precision: 5,
    scale: 2,
  })
  valorLancamento: number | null;

  @Column({ type: Number, unique: false, nullable: true })
  numeroDocumentoBanco: number | null;

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
    type: 'decimal', unique: false, nullable: true,
    precision: 5,
    scale: 2,
  })
  valorRealEfetivado: number | null;

  @Column({ type: Number, unique: false, nullable: false })
  nsr: number;

  @Column({ type: String, unique: false, nullable: true, length: 10 })
  ocorrencias: string | null;

  @CreateDateColumn()
  createdAt: Date;

  /**
   * For some reason, fields like 'time', 'decimal'
   * are received as string instead as Date, Number
   */
  @AfterLoad()
  castFields() {
    this.quantidadeMoeda = asNullableStringOrNumber(this.quantidadeMoeda);
    this.valorLancamento = asNullableStringOrNumber(this.valorLancamento);
    this.valorRealEfetivado = asNullableStringOrNumber(this.valorRealEfetivado);
  }
}
