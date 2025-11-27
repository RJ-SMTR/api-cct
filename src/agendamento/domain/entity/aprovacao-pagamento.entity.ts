import { AprovacaoEnum } from 'src/agendamento/enums/aprovacao.enum';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import {  Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,  UpdateDateColumn } from 'typeorm';

@Entity()
export class AprovacaoPagamento extends EntityHelper {
  constructor(dto?: DeepPartial<AprovacaoPagamento>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  /** id_ordem_pagamento_consorcio_operador_dia */
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_AprovacaoPagamentoId' })
  id: number;  

  @ManyToOne(() => DetalheA, { eager: true, nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheA_ManyToOne' })
  detalheA: DetalheA;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 13,
    scale: 5,
  })
  valorGerado: number;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 13,
    scale: 5,
  })
  valorAprovado: number;


  @Column({ type: 'date', unique: false, nullable: true })
  dataAprovacao: Date;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_AprovadorUsuario_ManyToOne' })
  aprovador: User;

  @Column({
    type: 'enum',
    enum: AprovacaoEnum,
    default: AprovacaoEnum.Aprovado
  })
  status: AprovacaoEnum;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}