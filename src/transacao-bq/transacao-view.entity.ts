import { BigqueryTransacao } from 'src/bigquery/entities/transacao.bigquery-entity';
import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { TicketRevenueDTO } from 'src/ticket-revenues/dtos/ticket-revenue.dto';
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
}

/**
 * Unique: [datetimeTransacao, datetimeProcessamento]
 */
@Entity()
export class TransacaoView {
  constructor(transacao?: DeepPartial<TransacaoView>) {
    if (transacao) {
      Object.assign(this, transacao);
    }
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
    });
  }

  toTicketRevenue(publicacoes: ArquivoPublicacao[]) {
    const publicacoesTv = publicacoes.filter((p) => p.itemTransacao.itemTransacaoAgrupado.id == this.itemTransacaoAgrupadoId);
    const publicacao: ArquivoPublicacao | undefined = publicacoesTv.filter((p) => p.isPago)[0] || publicacoesTv[0];
    const isPago = publicacao?.isPago == true;
    const revenue = new TicketRevenueDTO({
      bqDataVersion: '',
      captureDateTime: this.datetimeCaptura.toISOString(),
      clientId: null,
      directionId: null,
      integrationId: null,
      date: this.datetimeProcessamento.toISOString(),
      paymentMediaType: this.tipoPagamento,
      processingDateTime: this.datetimeProcessamento.toISOString(),
      processingHour: this.datetimeProcessamento.getHours(),
      stopId: null,
      stopLat: null,
      stopLon: null,
      transactionDateTime: this.datetimeTransacao.toISOString(),
      transactionId: this.idTransacao,
      transactionLat: null,
      transactionLon: null,
      transactionType: this.tipoTransacao,
      paidValue: this.valorPago || 0,
      transactionValue: this.valorTransacao,
      transportIntegrationType: null,
      transportType: null,
      vehicleId: null,
      vehicleService: null,
      arquivoPublicacao: this.arquivoPublicacao || undefined,
      itemTransacaoAgrupadoId: this.itemTransacaoAgrupadoId || undefined,
      isPago,
      count: 1,
    });
    return revenue;
  }

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
