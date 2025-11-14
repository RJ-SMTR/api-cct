import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import {  Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne,  PrimaryGeneratedColumn,  UpdateDateColumn } from 'typeorm';
import { AprovacaoPagamento } from './aprovacao-pagamento.entity';

@Entity()
export class AgendamentoPagamento extends EntityHelper {
  constructor(dto?: DeepPartial<AgendamentoPagamento>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  /** id_ordem_pagamento_consorcio_operador_dia */
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_AgendamentoPagamentoId' })
  id: number;  

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  tipoBeneficiario: string | null;//Consorcio /Individual

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_BeneficiarioUsuario_ManyToOne' })
  beneficiarioUsuario: User;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  tipoPagamento: string | null; //Unico/Recorrente


  @Column({ type: 'date', unique: false })
  dataPagamentoUnico: Date;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valorPagamentoUnico: number;

  @Column({ type: String, unique: false, nullable: true })
  motivoPagamentoUnico: string;

  @ManyToOne(() => Pagador, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Pagador_ManyToOne' })
  pagador: Pagador;

  @Column({ type: String, unique: false, nullable: true })
  diaSemana: string;

  @Column({ type: 'time', unique: false, nullable: false })
  horario: Date;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ResponsavelUsuario_ManyToOne' })
  responsavel: User;

  @Column({ type: 'boolean', unique: false, nullable: true })
  aprovacao: boolean;

  @ManyToOne(() => AprovacaoPagamento, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_AprovacaoPagamento_ManyToOne' })
  aprovacaoPagamento: AprovacaoPagamento;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_CadastradorUsuario_ManyToOne' })
  cadastrador: User;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ModificadorUsario_ManyToOne' })
  modificador: User;

  @Column({ type: 'boolean', unique: false, nullable: true })
  status: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}