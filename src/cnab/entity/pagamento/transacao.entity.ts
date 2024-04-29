import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Pagador } from './pagador.entity';
import { TransacaoOcorrencia } from './transacao-ocorrencia.entity';
import { TransacaoStatus } from './transacao-status.entity';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';
import { ItemTransacao } from './item-transacao.entity';

@Entity()
export class Transacao extends EntityHelper {
  constructor(transacao?: Transacao | DeepPartial<Transacao>) {
    super();
    if (transacao !== undefined) {
      Object.assign(this, transacao);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Transacao_id' })
  id: number;

  @Column({ type: Date, unique: false, nullable: true })
  dataOrdem: Date;

  @Column({ type: Date, unique: false, nullable: true })
  dataPagamento: Date | null;

  /**
   * References BigqueryOrdemPagamento. Unique ID column for Jaé
   *
   * uniqueColumnName: `UQ_Transacao_idOrdemPagamento`
   */
  @Column({ type: String, unique: true, nullable: true })
  idOrdemPagamento: string | null;

  @ManyToOne(() => Pagador, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Transacao_pagador_ManyToOne' })
  pagador: Pagador;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => TransacaoStatus, { eager: false, nullable: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Transacao_status_ManyToOne' })
  status: TransacaoStatus;

  /** Not a physical column */
  @OneToMany(() => LancamentoEntity, (lancamento) => lancamento.transacao, {
    nullable: true,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_Transacao_lancamentos_OneToMany',
  })
  lancamentos: LancamentoEntity[] | null;

  /** Not a physical column. CNAB errors */
  @OneToMany(() => TransacaoOcorrencia, (ocorrencia) => ocorrencia.transacao)
  @JoinColumn({
    foreignKeyConstraintName: 'FK_Transacao_ocorrencias_OneToMany',
  })
  ocorrencias: TransacaoOcorrencia[];

  /** Not a physical column */
  @OneToMany(() => ItemTransacao, (item) => item.transacao)
  @JoinColumn({
    foreignKeyConstraintName: 'FK_Transacao_itensTransacao_OneToMany',
  })
  itensTransacao: ItemTransacao[];

  public static getUniqueId(entity: DeepPartial<Transacao>): string {
    return `${entity.idOrdemPagamento}`;
  }

  public getLogInfo(): string {
    const response = `#${this.id}`;
    return response;
  }
}
