import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { HeaderArquivoConf } from './header-arquivo-conf.entity';
import { Pagador } from '../pagamento/pagador.entity';


/**
 * Pagamento.HeaderLote
 */
@Entity()
export class HeaderLoteConf extends EntityHelper {
  constructor(dto?: DeepPartial<HeaderLoteConf>) {
    super();
  if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_HeaderLoteConf_id' })
  id: number;

  @ManyToOne(() => HeaderArquivoConf, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_HeaderLoteConf_headerArquivo_ManyToOne',
  })
  headerArquivo: HeaderArquivoConf;

  /**
   * Unique lote Id in HeaderArquivo, incremental.
   *
   * Each HeaderArquivo will have loteServico 1 for lote 1; loteServico = 2 for lote 2 etc.
   */
  @Column({ type: Number, unique: false, nullable: true })
  loteServico: number | null;

  @Column({ type: String, unique: false, nullable: true })
  tipoInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true })
  numeroInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true })
  codigoConvenioBanco: string | null;

  @Column({ type: String, unique: false, nullable: true })
  tipoCompromisso: string;

  @Column({ type: String, unique: false, nullable: true })
  parametroTransmissao: string;

  @Column({ type: String, unique: false, nullable: true })
  formaLancamento: string;

  @ManyToOne(() => Pagador, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_HeaderLoteConf_pagador_ManyToOne' })
  pagador: Pagador;

  @CreateDateColumn()
  createdAt: Date;  
}
