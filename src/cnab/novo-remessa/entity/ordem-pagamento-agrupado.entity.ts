import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn,  ManyToOne,  OneToMany, 
   PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrdemPagamento } from './ordem-pagamento.entity';
import { OrdemPagamentoAgrupadoHistorico } from './ordem-pagamento-agrupado-historico.entity';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';

@Entity()
export class OrdemPagamentoAgrupado extends EntityHelper {
  constructor(dto?: DeepPartial<OrdemPagamentoAgrupado>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_OrdemPagamentoAgrupadoId' })
  id: number;  

  @Column({
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valorTotal: number;  

  @Column({ type: Date, unique: false, nullable: false })
  dataPagamento: Date;
  
  @OneToMany(() => OrdemPagamento, (op) => op.ordemPagamentoAgrupado, { eager: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_OrdemPagamentoAgrupado_ordensPagamento_OneToMany' })
  ordensPagamento: OrdemPagamento[];

  @OneToMany(() => OrdemPagamentoAgrupadoHistorico, (op) => op.ordemPagamentoAgrupado, { eager: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_OrdemPagamentoAgrupadoHistorico_ordensPagamento_OneToMany' })
  ordensPagamentoAgrupadoHistorico: OrdemPagamentoAgrupadoHistorico[];

  @ManyToOne(() => Pagador, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_OrdemPagamentoAgrupado_pagador_ManyToOne',
  })
  pagador: Pagador;

  @CreateDateColumn()
  createdAt: Date; 

  @UpdateDateColumn() 
  updatedAt: Date; 
}