import { EntityHelper } from 'src/utils/entity-helper';
import { User } from 'src/users/entities/user.entity';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { OrdemPagamentoAgrupado } from './ordem-pagamento-agrupado.entity';

@Entity('ordem_pagamento_guardador')
export class OrdemPagamentoGuardador extends EntityHelper {
  constructor(entity?: DeepPartial<OrdemPagamentoGuardador>) {
    super();
    if (entity) {
      Object.assign(this, entity);
    }
  }

  @PrimaryColumn({
    name: 'id',
    primaryKeyConstraintName: 'PK_OrdemPagamentoGuardadorId',
  })
  id: number;

  @Column({ name: 'dataOrdem', type: 'date', unique: false, nullable: false })
  dataOrdem: Date;

  @Column({ name: 'qtdVerificacaoTotal', type: Number, unique: false, nullable: false })
  qtdVerificacaoTotal: number;


  @Column({ name: 'qtdVerificacaoValida', type: Number, unique: false, nullable: false })
  qtdVerificacaoValida: number;

  @Column({ name: 'qtdVerificacaoInvalida', type: Number, unique: false, nullable: false })
  qtdVerificacaoInvalida: number;

  @Column({
    name: 'valorRepasseGuardador',
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valorRepasseGuardador: number;

  @Column({ name: 'dataInclusao', type: 'date', unique: false, nullable: false })
  dataInclusao: Date;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_OrdemPagamentoGuardador_user_ManyToOne' })
  user: User;

  @ManyToOne(() => OrdemPagamentoAgrupado, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_OrdemPagamentoAgrupado_ManyToOne' })
  ordemPagamentoAgrupado: OrdemPagamentoAgrupado;

  @Column({
    name: 'tipoOrdemPagamento',
    type: 'varchar',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  tipoOrdemPagamento: string; /* AUTOMATICA OU MANUAL */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

}