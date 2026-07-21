import { EntityHelper } from 'src/utils/entity-helper';
import { User } from 'src/users/entities/user.entity';
import { Column, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity('ordem_pagamento_guardador')
export class OrdemPagamentoGuardador extends EntityHelper {
  constructor(dto?: DeepPartial<OrdemPagamentoGuardador>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryColumn({
    name: 'id',
    primaryKeyConstraintName: 'PK_OrdemPagamentoGuardadorId',
  })
  id: number;

  @Column({ name: 'data_ordem', type: 'date', unique: false, nullable: false })
  dataOrdem: Date;

  @Column({ name: 'quantidade_verificacao_total', type: Number, unique: false, nullable: false })
  qtdVerificacaoTotal: number;


  @Column({ name: 'quantidade_verificacao_valida', type: Number, unique: false, nullable: false })
  qtdVerificacaoValida: number;

  @Column({ name: 'quantidade_verificacao_invalida', type: Number, unique: false, nullable: false })
  qtdVerificacaoInvalida: number;

  @Column({
    name: 'valor_repasse_guardador',
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valorRepasseGuardador: number;

  @Column({ name: 'data_inclusao', type: 'date', unique: false, nullable: false })
  dataInclusao: Date;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_OrdemPagamentoGuardador_user_ManyToOne' })
  user: User;

}