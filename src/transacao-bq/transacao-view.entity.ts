import { BigqueryTransacao } from 'src/bigquery/entities/transacao.bigquery-entity';
import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { ITicketRevenue } from 'src/ticket-revenues/interfaces/ticket-revenue.interface';
import { asStringDate } from 'src/utils/pipe-utils';
import {
  AfterLoad,
  Column,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class TransacaoView {
  constructor(transacao?: DeepPartial<TransacaoView>) {
    if (transacao) {
      Object.assign(this, transacao);
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

  @Column({ type: String, nullable: true })
  tipoTransacao: string | null;

  @Column({ type: String, nullable: true })
  tipoGratuidade: string | null;

  @Column({ type: 'numeric' })
  valorTransacao: number;

  @Column({ type: String, nullable: true })
  operadoraCpfCnpj: string | null;

  @Column({ type: String, nullable: true })
  consorcioCnpj: string | null;

  @ManyToOne(() => ArquivoPublicacao, { eager: true, nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoView_arquivoPublicacao_ManyToOne',
  })
  arquivoPublicacao: ArquivoPublicacao | null;

  @AfterLoad()
  setReadValues() {
    this.valorTransacao = Number(this.valorTransacao);
  }

  public static newFromBigquery(bq: BigqueryTransacao) {
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
      operadoraCpfCnpj: bq.operadoraCpfCnpj,
      consorcioCnpj: bq.consorcioCnpj,
    });
  }

  toTicketRevenue() {
    return {
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
      transactionValue: this.valorTransacao,
      transportIntegrationType: null,
      transportType: null,
      vehicleId: null,
      vehicleService: null,
    } as ITicketRevenue;
  }
}
