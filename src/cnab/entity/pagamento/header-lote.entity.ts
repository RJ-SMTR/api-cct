import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { HeaderArquivo } from './header-arquivo.entity';
import { Pagador } from '../intermediate/pagador.entity';

/**
 * Pagamento.HeaderLote
 */
@Entity()
export class HeaderLote extends EntityHelper {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_HeaderLote_id' })
  id: number;

  @ManyToOne(() => HeaderArquivo, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_HeaderLote_headerArquivo_ManyToOne' })
  headerArquivo: HeaderArquivo;

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

  @ManyToOne(() => Pagador, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_HeaderLote_pagador_ManyToOne' })
  pagador: Pagador;

  @CreateDateColumn()
  createdAt: Date;
}
