import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import {  Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryColumn,  UpdateDateColumn } from 'typeorm';

@Entity()
export class AprovacaoPagamento extends EntityHelper {
  constructor(dto?: DeepPartial<AprovacaoPagamento>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  /** id_ordem_pagamento_consorcio_operador_dia */
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_OrdemPagamentoId' })
  id: number;  

  @ManyToOne(() => DetalheA, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheA_ManyToOne' })
  detalheA: DetalheA;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valorGerado: number;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valorAprovado: number;


  @Column({ type: 'date', unique: false, nullable: false })
  dataAprovacao: Date;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_AprovadorUsuario_ManyToOne' })
  aprovador: User;

  @Column({ type: String, unique: false, nullable: true })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}