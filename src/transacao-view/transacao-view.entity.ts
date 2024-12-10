import { ApiProperty } from '@nestjs/swagger';
import { BigqueryTransacao } from 'src/bigquery/entities/transacao.bigquery-entity';
import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { asStringDate } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface ITransacaoView {
  id: number;
  datetimeTransacao: Date;
  datetimeProcessamento: Date;
  datetimeCaptura: Date;
  modo: string;
  idConsorcio: string | null;
  nomeConsorcio: string;
  idOperadora: string | null;
  nomeOperadora: string;
  idTransacao: string;
  tipoPagamento: string;
  tipoTransacao: string | null;
  tipoGratuidade: string | null;
  valorTransacao: number;
  valorPago: number | null;
  operadoraCpfCnpj: string | null;
  consorcioCnpj: string | null;
  arquivoPublicacao: ArquivoPublicacao | null;
  itemTransacaoAgrupadoId: number | null;
  createdAt: Date;
  updatedAt: Date;
  idOrdemPagamento: number | null;
}

/**
 * Unique: [datetimeTransacao, datetimeProcessamento]
 */
@Entity()
export class TransacaoView {
  constructor(transacao?: DeepPartial<TransacaoView>) {
    if (transacao) {
      Object.assign(this, transacao);
      if (transacao.arquivoPublicacao) {
        this.arquivoPublicacao = new ArquivoPublicacao(transacao.arquivoPublicacao);
      }
    }
  }

  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_TransacaoView_id',
  })
  id: number;

  @Column({ type: Date })
  datetimeTransacao: Date;

  /**
   * uniqueConstraintName: `UQ_TransacaoView_datetimeProcessamento`
   *
   * D+0 (qui-qua)
   */
  @Column({ type: Date })
  datetimeProcessamento: Date;

  @Column({ type: Date })
  datetimeCaptura: Date;

  @Column({ type: String })
  modo: string;

  @Column({ type: String, nullable: true })
  idConsorcio: string | null;

  @Column({ type: String })
  nomeConsorcio: string;

  @Column({ type: String, nullable: true })
  idOperadora: string | null;

  @Column({ type: String })
  nomeOperadora: string;

  @Column({ type: String })
  idTransacao: string;

  @Column({ type: String })
  tipoPagamento: string;

  @ApiProperty({ examples: ['Gratuidade', 'Débito', 'Débito EMV', 'Gratuidade', 'Integração', 'Integral', 'Transferência'] })
  @Column({ type: String, nullable: true })
  tipoTransacao: string | null;

  @Column({ type: String, nullable: true })
  tipoGratuidade: string | null;

  @Column({ type: 'numeric' })
  valorTransacao: number;

  @Column({ type: 'numeric', nullable: true })
  valorPago: number | null;

  @Column({ type: String, nullable: true })
  operadoraCpfCnpj: string | null;

  @Column({ type: String, nullable: true })
  consorcioCnpj: string | null;

  @Column({ type: Number, nullable: true })
  idOrdemPagamento: number | null;

  /** @deprecated Replaced by `itemTransacaoAgrupadoId` */
  @ManyToOne(() => ArquivoPublicacao, { eager: true, nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoView_arquivoPublicacao_ManyToOne',
  })
  arquivoPublicacao: ArquivoPublicacao | null;

  @Column({ type: 'numeric', nullable: true })
  itemTransacaoAgrupadoId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @AfterLoad()
  setReadValues() {
    this.valorTransacao = Number(this.valorTransacao);
    this.valorPago = this.valorPago === null ? null : Number(this.valorPago);
    if (this.itemTransacaoAgrupadoId !== undefined && this.itemTransacaoAgrupadoId !== null) {
      this.itemTransacaoAgrupadoId = +this.itemTransacaoAgrupadoId;
    }
  }

  public static getSqlFields(table?: string, castValues?: boolean): Record<keyof ITransacaoView, string> {
    return {
      id: `${table ? `${table}.` : ''}"id"`,
      datetimeTransacao: `${table ? `${table}.` : ''}"datetimeTransacao"`,
      datetimeProcessamento: `${table ? `${table}.` : ''}"datetimeProcessamento"`,
      datetimeCaptura: `${table ? `${table}.` : ''}"datetimeCaptura"`,
      modo: `${table ? `${table}.` : ''}"modo"`,
      idConsorcio: `${table ? `${table}.` : ''}"idConsorcio"`,
      nomeConsorcio: `${table ? `${table}.` : ''}"nomeConsorcio"`,
      idOperadora: `${table ? `${table}.` : ''}"idOperadora"`,
      nomeOperadora: `${table ? `${table}.` : ''}"nomeOperadora"`,
      idTransacao: `${table ? `${table}.` : ''}"idTransacao"`,
      tipoPagamento: `${table ? `${table}.` : ''}"tipoPagamento"`,
      tipoTransacao: `${table ? `${table}.` : ''}"tipoTransacao"`,
      tipoGratuidade: `${table ? `${table}.` : ''}"tipoGratuidade"`,
      valorTransacao: `${table ? `${table}.` : ''}"valorTransacao"${castValues ? '::FLOAT' : ''}`,
      valorPago: `${table ? `${table}.` : ''}"valorPago"${castValues ? '::FLOAT' : ''}`,
      operadoraCpfCnpj: `${table ? `${table}.` : ''}"operadoraCpfCnpj"`,
      consorcioCnpj: `${table ? `${table}.` : ''}"consorcioCnpj"`,
      arquivoPublicacao: `${table ? `${table}.` : ''}"arquivoPublicacaoId"`,
      itemTransacaoAgrupadoId: `${table ? `${table}.` : ''}"itemTransacaoAgrupadoId"`,
      createdAt: `${table ? `${table}.` : ''}"createdAt"`,
      updatedAt: `${table ? `${table}.` : ''}"updatedAt"`,
    };
  }

  public static sqlFieldTypes: Record<keyof ITransacaoView, string> = {
    id: 'INT',
    datetimeTransacao: 'TIMESTAMP',
    datetimeProcessamento: 'TIMESTAMP',
    datetimeCaptura: 'TIMESTAMP',
    modo: 'VARCHAR',
    idConsorcio: 'VARCHAR',
    nomeConsorcio: 'VARCHAR',
    idOperadora: 'VARCHAR',
    nomeOperadora: 'VARCHAR',
    idTransacao: 'VARCHAR',
    tipoPagamento: 'VARCHAR',
    tipoTransacao: 'VARCHAR',
    tipoGratuidade: 'VARCHAR',
    valorTransacao: 'NUMERIC',
    valorPago: 'NUMERIC',
    operadoraCpfCnpj: 'VARCHAR',
    consorcioCnpj: 'VARCHAR',
    arquivoPublicacao: 'INT',
    itemTransacaoAgrupadoId: 'INT',
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  };

  public static fromBigqueryTransacao(bq: BigqueryTransacao) {
    return new TransacaoView({
      datetimeCaptura: asStringDate(bq.datetime_captura),
      datetimeProcessamento: asStringDate(bq.datetime_processamento),
      datetimeTransacao: asStringDate(bq.datetime_transacao),
      idConsorcio: bq.id_consorcio,
      idOperadora: bq.id_operadora,
      idTransacao: bq.id_transacao,
      modo: bq.modo,
      nomeConsorcio: bq.consorcio,
      nomeOperadora: bq.operadora,
      tipoGratuidade: bq.tipo_gratuidade,
      tipoPagamento: bq.tipo_pagamento,
      tipoTransacao: bq.tipo_transacao,
      valorTransacao: bq.valor_transacao,
      valorPago: bq.valor_pagamento,
      operadoraCpfCnpj: bq.operadoraCpfCnpj,
      consorcioCnpj: bq.consorcioCnpj,
      idOrdemPagamento: bq.id_ordem_pagamento
    });
  }

  // toTicketRevenue(publicacoes: ArquivoPublicacao[]) {
  //   const publicacoesTv = publicacoes.filter((p) => p.itemTransacao.itemTransacaoAgrupado.id == this.itemTransacaoAgrupadoId);
  //   const publicacao: ArquivoPublicacao | undefined = publicacoesTv.filter((p) => p.isPago)[0] || publicacoesTv[0];
  //   const isPago = publicacao?.isPago == true;
  //   const revenue = new TicketRevenueDTO({
  //     captureDateTime: this.datetimeCaptura.toISOString(),
  //     date: this.datetimeProcessamento.toISOString(),
  //     paymentMediaType: this.tipoPagamento,
  //     processingDateTime: this.datetimeProcessamento.toISOString(),
  //     processingHour: this.datetimeProcessamento.getHours(),
  //     transactionDateTime: this.datetimeTransacao.toISOString(),
  //     transactionId: this.idTransacao,
  //     transactionType: this.tipoTransacao,
  //     paidValue: this.valorPago || 0,
  //     transactionValue: this.valorTransacao,
  //     transportIntegrationType: null,
  //     transportType: null,
  //     arquivoPublicacao: this.arquivoPublicacao || undefined,
  //     itemTransacaoAgrupadoId: this.itemTransacaoAgrupadoId || undefined,
  //     isPago,
  //     count: 1,
  //     ocorrencias: [],
  //   });
  //   return revenue;
  // }

  getProperties() {
    return {
      id: this.id,
      datetimeTransacao: this.datetimeTransacao,
      datetimeProcessamento: this.datetimeProcessamento,
      datetimeCaptura: this.datetimeCaptura,
      modo: this.modo,
      idConsorcio: this.idConsorcio,
      nomeConsorcio: this.nomeConsorcio,
      idOperadora: this.idOperadora,
      nomeOperadora: this.nomeOperadora,
      idTransacao: this.idTransacao,
      tipoPagamento: this.tipoPagamento,
      tipoTransacao: this.tipoTransacao,
      tipoGratuidade: this.tipoGratuidade,
      valorTransacao: this.valorTransacao,
      valorPago: this.valorPago,
      operadoraCpfCnpj: this.operadoraCpfCnpj,
      consorcioCnpj: this.consorcioCnpj,
      arquivoPublicacao: this.arquivoPublicacao,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
