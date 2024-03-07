import { EntityHelper } from 'src/utils/entity-helper';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClienteFavorecido } from './cliente-favorecido.entity';
import { HeaderLote } from './header-lote.entity';

@Entity()
export class DetalheA extends EntityHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => HeaderLote, {eager: true})
  headerLote: HeaderLote;

  @Column({ type: String, unique: false, nullable: true })
  loteServico?: string;

  @Column({ type: Number, unique: false, nullable: true })
  clienteFavorecido?: ClienteFavorecido;

  @Column({ type: String, unique: false, nullable: true })
  tipoFinalidadeConta?: string;

  @Column({ type: Date, unique: false, nullable: true })
  dataVencimento?: Date;

  @Column({ type: String, unique: false, nullable: true })
  tipoMoeda?: string;

  @Column({ type: Number, unique: false, nullable: true })
  quantidadeMoeda?: number;

  @Column({ type: String, unique: false, nullable: true })
  valorLancamento?: number;

  @Column({ type: String, unique: false, nullable: true })
  numeroDocumentoLancamento?: number;

  @Column({ type: String, unique: false, nullable: true })
  quantidadeParcelas?: number;

  @Column({ type: String, unique: false, nullable: true })
  indicadorBloqueio?: string;

  @Column({ type: String, unique: false, nullable: true })
  indicadorFormaParcelamento?: string;

  @Column({ type: Date, unique: false, nullable: true })
  periodoVencimento?: Date;

  @Column({ type: String, unique: false, nullable: true })
  numeroParcela?: number;

  @Column({ type: Date, unique: false, nullable: true })
  dataEfetivacao?: Date;

  @Column({ type: Number, unique: false, nullable: true })
  valorRealEfetivado?: number;

  @Column({ type: Number, unique: false, nullable: false })
  nsr: number;

  @Column({ type: String, length: 10, nullable: true })
  ocorrencias?: string;
}
