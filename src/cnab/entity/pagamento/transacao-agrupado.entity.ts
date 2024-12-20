import { OrdemPagamentoDto } from 'src/cnab/dto/pagamento/ordem-pagamento.dto';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { Lancamento } from 'src/lancamento/entities/lancamento.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ItemTransacaoAgrupado } from './item-transacao-agrupado.entity';
import { Pagador } from './pagador.entity';
import { TransacaoStatus } from './transacao-status.entity';
import { Transacao } from './transacao.entity';

/**
 * Unique Jaé ID: [idOrdemPagamento, idConsorcio, idOperadora]
 */
@Entity()
export class TransacaoAgrupado extends EntityHelper {
  constructor(dto?: DeepPartial<TransacaoAgrupado>) {
    super();
    if (dto !== undefined) {
      Object.assign(this, dto);
      if (dto?.status) {
        this.status = new TransacaoStatus(dto.status);
      }
    }
  }


  public static fromOrdem(ordem: OrdemPagamentoDto, pagador: Pagador) {
    const transacao = new TransacaoAgrupado({
      dataOrdem: ordem.getTransacaoAgrupadoDataOrdem(),
      dataPagamento: null,
      pagador: pagador,
      idOrdemPagamento: ordem.idOrdemPagamento,
      status: TransacaoStatus.fromEnum(TransacaoStatusEnum.created),
    });
    return transacao;
  }

  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_TransacaoAgrupado_id',
  })
  id: number;

  /** sexta de pagamento (baseado no BigqueryOrdemPgto.dataOrdem) */
  @Column({ type: Date, unique: false, nullable: true })
  dataOrdem: Date;

  @Column({ type: Date, unique: false, nullable: true })
  dataPagamento: Date | null;

  /**
   * Unique ID BQ Jaé
   */
  @Column({ type: String, unique: false, nullable: true })
  idOrdemPagamento: string | null;

  @ManyToOne(() => Pagador, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoAgrupado_pagador_ManyToOne',
  })
  pagador: Pagador;

  @ManyToOne(() => TransacaoStatus, { eager: true, nullable: false })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoAgrupado_status_ManyToOne',
  })
  status: TransacaoStatus;

  /** Not a physical column */
  @OneToMany(() => Lancamento, (lancamento) => lancamento.itemTransacao, {
    nullable: true,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoAgrupado_lancamentos_OneToMany',
  })
  lancamentos: Lancamento[] | null;

  /** Not a physical column */
  @OneToMany(() => ItemTransacaoAgrupado, (item) => item.transacaoAgrupado, {
    eager: false,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoAgrupado_itemTransacoes_OneToMany',
  })
  itemTransacoesAgrupado: ItemTransacaoAgrupado[];

  @OneToMany(() => Transacao, (transacao) => transacao.transacaoAgrupado, {
    eager: true,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoAgrupado_transacoes_OneToMany',
  })
  transacoes: Transacao[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public static getUniqueId(entity: DeepPartial<Transacao>): string {
    return `${entity.idOrdemPagamento}`;
  }

  public getLogInfo(): string {
    const response = `#${this.id}`;
    return response;
  }
}
