import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { HeaderArquivo } from './header-arquivo.entity';
import { Pagador } from './pagador.entity';
import { Cnab104CodigoCompromisso } from 'src/cnab/enums/104/cnab-104-codigo-compromisso.enum';
import { DetalheA } from './detalhe-a.entity';

/**
 * Pagamento.HeaderLote
 */
@Entity()
export class HeaderLote extends EntityHelper {
  constructor(dto?: DeepPartial<HeaderLote>) {
    super();
    if (dto) {
      Object.assign(this, dto);
      if (dto.headerArquivo) {
        dto.headerArquivo = new HeaderArquivo(dto.headerArquivo);
      }
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_HeaderLote_id' })
  id: number;

  @ManyToOne(() => HeaderArquivo, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_HeaderLote_headerArquivo_ManyToOne',
  })
  headerArquivo: HeaderArquivo;

  /**
   * Unique lote Id in HeaderArquivo, incremental.
   *
   * Each HeaderArquivo will have loteServico 1 for lote 1; loteServico = 2 for lote 2 etc.
   */
  @Column({ type: Number, unique: false, nullable: true })
  loteServico: number;

  @Column({ type: String, unique: false, nullable: true })
  tipoInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true })
  numeroInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true })
  codigoConvenioBanco: string | null;

  @Column({ type: String, unique: false, nullable: true })
  tipoCompromisso: string;

  /** Definido pelo banco, se é teste ou produção */
  @Column({ enum: Cnab104CodigoCompromisso, unique: false, nullable: false, default: Cnab104CodigoCompromisso.Producao })
  codigoCompromisso: Cnab104CodigoCompromisso;
  
  @Column({ type: String, unique: false, nullable: true })
  parametroTransmissao: string;

  @Column({ type: String, unique: false, nullable: true })
  formaLancamento: string;

  @ManyToOne(() => Pagador, { eager: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_HeaderLote_pagador_ManyToOne' })
  pagador: Pagador;

  @OneToMany(() => DetalheA, (detalheA) => detalheA.headerLote, {
      eager: false,
    })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_HeaderLote_detalheA_OneToMany',
  })
  detalhesA: DetalheA[];

  @CreateDateColumn()
  createdAt: Date;

  /**
   * ID: headerArquivo UniqueId + headerLote columns
   */
  public static getUniqueId(item?: DeepPartial<HeaderLote>, headerArqUniqueId?: string): string {
    const _headerArqUniqueId = headerArqUniqueId ? `(${headerArqUniqueId})` : `(${HeaderArquivo.getUniqueId(item?.headerArquivo)})`;
    return `${_headerArqUniqueId}|${item?.loteServico}`;
  }
}
