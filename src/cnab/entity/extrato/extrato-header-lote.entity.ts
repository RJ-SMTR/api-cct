import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExtratoHeaderArquivo } from './extrato-header-arquivo.entity';

@Entity()
export class ExtratoHeaderLote extends EntityHelper {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_ExtratoHeaderLote_id' })
  id: number;

  @ManyToOne(() => ExtratoHeaderArquivo, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ExtratoHeaderLote_extratoHeaderArquivo_ManyToOne' })
  extratoHeaderArquivo: ExtratoHeaderArquivo;

  @Column({ type: Number, unique: false, nullable: true })
  loteServico: number | null;

  @Column({ type: String, unique: false, nullable: true })
  tipoInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true })
  numeroInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true })
  codigoConvenioBanco: string | null;

  @Column({ type: String, unique: false, nullable: true })
  tipoCompromisso: string | null;

  @Column({ type: String, unique: false, nullable: true })
  parametroTransmissao: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
