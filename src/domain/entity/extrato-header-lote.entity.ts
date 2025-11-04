import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExtratoHeaderArquivo as ExtratoHeaderArquivo } from './extrato-header-arquivo.entity';

/**
 * We purposefully have defineed fields that as not null in the logic
 * but null in the database. To simplify further business rules changes.
 */
@Entity()
export class ExtratoHeaderLote extends EntityHelper {

  constructor(dto?: DeepPartial<ExtratoHeaderLote>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_ExtratoHeaderLote_id' })
  id: number;

  @ManyToOne(() => ExtratoHeaderArquivo, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ExtratoHeaderLote_extratoHeaderArquivo_ManyToOne' })
  extratoHeaderArquivo: ExtratoHeaderArquivo;

  @Column({ type: Number, unique: false, nullable: true })
  loteServico: number;

  @Column({ type: String, unique: false, nullable: true })
  tipoInscricao: string;

  @Column({ type: String, unique: false, nullable: true })
  numeroInscricao: string;

  @Column({ type: String, unique: false, nullable: true })
  codigoConvenioBanco: string;

  @Column({ type: Date, unique: false, nullable: false })
  dataSaldoInicial: Date;

  @Column({
    type: 'decimal', unique: false, nullable: false,
    precision: 16, scale: 2,
  })
  valorSaldoInicial: number;

  @Column({ type: String, unique: false, nullable: false, length: 1 })
  situacaoSaldoInicial: string;

  @Column({ type: String, unique: false, nullable: false, length: 1 })
  posicaoSaldoInicial: string;

  @Column({ type: String, unique: false, nullable: false, length: 3 })
  tipoMoeda: string;

  @CreateDateColumn()
  createdAt: Date;
}
