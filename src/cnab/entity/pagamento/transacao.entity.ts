import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Pagador } from './pagador.entity';
import { TransacaoOcorrencia } from './transacao-ocorrencia.entity';
import { TransacaoStatus } from './transacao-status.entity';

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

  /**  */
  @Column({ type: Date, unique: false, nullable: true })
  dataOrdem: Date;

  @Column({ type: Date, unique: false, nullable: true })
  dataPagamento: Date | null;

  /** 
   * References BigqueryOrdemPagamento. Unique ID column
   * 
   * uniqueColumnName: `UQ_Transacao_idOrdemPagamento`
   */
  @Column({ type: String, unique: true, nullable: true })
  idOrdemPagamento: string;

  @ManyToOne(() => Pagador, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Transacao_pagador_ManyToOne' })
  pagador: Pagador;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => TransacaoStatus, { eager: false, nullable: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Transacao_status_ManyToOne' })
  status: TransacaoStatus;

  /** CNAB errors */
  @OneToMany(() => TransacaoOcorrencia, ocorrencia => ocorrencia.transacao)
  @JoinColumn({ foreignKeyConstraintName: 'FK_Transacao_ocorrencias_OneToMany' })
  ocorrencias: TransacaoOcorrencia[];

  public static getUniqueId(entity: DeepPartial<Transacao>): string {
    return `${entity.idOrdemPagamento}`;
  }

  public getLogInfo(): string {
    const response = `#${this.id}`;
    return response;
  }
}
