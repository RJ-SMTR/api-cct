import { BigqueryTransacao } from 'src/bigquery/entities/transacao.bigquery-entity';
import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { asStringDate } from 'src/utils/pipe-utils';
import {
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
  @Column({ type: Date, unique: true })
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

  @ManyToOne(() => ArquivoPublicacao, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoView_arquivoPublicacao_ManyToOne',
  })
  arquivoPublicacao: ArquivoPublicacao | null;

  public static newFromBigquery(transacao: BigqueryTransacao) {
    return new TransacaoView({
      datetimeCaptura: asStringDate(transacao.datetime_captura),
      datetimeProcessamento: asStringDate(transacao.datetime_processamento),
      datetimeTransacao: asStringDate(transacao.datetime_transacao),
      idConsorcio: transacao.id_consorcio,
      idOperadora: transacao.id_operadora,
      idTransacao: transacao.id_transacao,
      modo: transacao.modo,
      nomeConsorcio: transacao.consorcio,
      nomeOperadora: transacao.operadora,
      tipoGratuidade: transacao.tipo_gratuidade,
      tipoPagamento: transacao.tipo_pagamento,
      tipoTransacao: transacao.tipo_transacao,
      valorTransacao: transacao.valor_transacao,
    });
  }
}
