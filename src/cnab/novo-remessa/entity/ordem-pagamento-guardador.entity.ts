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

  @Column({ name: 'id_status_ordem', type: Number, unique: false, nullable: false })
  idStatusOrdem: number;

  @Column({
    name: 'id_ordem_pagamento_estacionamento',
    type: Number,
    unique: false,
    nullable: false,
  })
  idOrdemPagamentoEstacionamento: number;

  @Column({ name: 'id_cliente', type: Number, unique: false, nullable: false })
  idCliente: number;

  @Column({ name: 'qtd_verificado', type: Number, unique: false, nullable: false })
  qtdVerificado: number;

  @Column({
    name: 'valor_unitario_verificado',
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valorUnitarioVerificado: number;

  @Column({
    name: 'valor_total_verificado',
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valorTotalVerificado: number;

  @Column({ name: 'data_pagamento', type: 'date', unique: false, nullable: false })
  dataPagamento: Date;

  @Column({ name: 'data_inclusao', type: 'date', unique: false, nullable: false })
  dataInclusao: Date;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_OrdemPagamentoGuardador_user_ManyToOne' })
  user: User;

  @Column({ name: 'userId', type: Number, unique: false, nullable: false })
  userId: number;
}