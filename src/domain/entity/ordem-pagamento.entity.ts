import { EntityHelper } from 'src/utils/entity-helper';
import {  Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrdemPagamentoAgrupado } from './ordem-pagamento-agrupado.entity';

@Entity()
export class OrdemPagamento extends EntityHelper {
  constructor(dto?: DeepPartial<OrdemPagamento>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  /** id_ordem_pagamento_consorcio_operador_dia */
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_OrdemPagamentoId' })
  id: number;

  @Column({ type: 'date', unique: false, nullable: false })
  dataOrdem: Date;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeConsorcio: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeOperadora: string | null;

  @Column({ type: Number, unique: false, nullable: true })
  userId?: number | undefined;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valor: number;

  @Column({ type: String, unique: false, nullable: true })
  idOrdemPagamento: string;

  @Column({ type: String, unique: false, nullable: true })
  idOperadora: string;

  @Column({ type: String, unique: false, nullable: true })
  operadoraCpfCnpj: string | null;

  @Column({ type: String, unique: false, nullable: true })
  idConsorcio: string | null;

  @ManyToOne(() => OrdemPagamentoAgrupado, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_OrdemPagamentoAgrupado_ManyToOne' })
  ordemPagamentoAgrupado: OrdemPagamentoAgrupado;

  @Column({ type: Date, unique: false, nullable: true })
  dataCaptura: Date | undefined;

  /**
   *
   */
  @Column({ type: Date, unique: false, nullable: false })
  bqUpdatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  ordemPagamentoAgrupadoId: number;
}