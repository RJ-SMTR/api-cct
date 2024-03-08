import { EntityHelper } from 'src/utils/entity-helper';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClienteFavorecido } from './cliente-favorecido.entity';
import { HeaderLote } from './header-lote.entity';

@Entity()
export class DetalheA extends EntityHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => HeaderLote, { eager: true })
  headerLote: HeaderLote;

  @Column({ type: String, unique: false, nullable: true })
  loteServico: string | null;

  @Column({ type: Number, unique: false, nullable: false })
  clienteFavorecido: ClienteFavorecido;

  @Column({ type: String, unique: false, nullable: true })
  tipoFinalidadeConta: string | null;

  @Column({ type: Date, unique: false, nullable: true })
  dataVencimento: Date | null;

  @Column({ type: String, unique: false, nullable: true })
  tipoMoeda: string | null;

  @Column({ type: Number, unique: false, nullable: true })
  quantidadeMoeda: number | null;

  @Column({ type: String, unique: false, nullable: true })
  valorLancamento: number | null;

  @Column({ type: String, unique: false, nullable: true })
  numeroDocumentoLancamento: number | null;

  @Column({ type: String, unique: false, nullable: true })
  quantidadeParcelas: number | null;

  @Column({ type: String, unique: false, nullable: true })
  indicadorBloqueio: string | null;

  @Column({ type: String, unique: false, nullable: true })
  indicadorFormaParcelamento: string | null;

  @Column({ type: Date, unique: false, nullable: true })
  periodoVencimento: Date | null;

  @Column({ type: String, unique: false, nullable: true })
  numeroParcela: number | null;

  @Column({ type: Date, unique: false, nullable: true })
  dataEfetivacao: Date | null;

  @Column({ type: Number, unique: false, nullable: true })
  valorRealEfetivado: number | null;

  @Column({ type: Number, unique: false, nullable: false })
  nsr: number;

  @Column({ type: String, unique: false, nullable: true, length: 10 })
  ocorrencias: string | null;
}
