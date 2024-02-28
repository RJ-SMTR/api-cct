import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Transacao extends EntityHelper {
  constructor(transacao?: Transacao | DeepPartial<Transacao>) {
    super();
    if (transacao !== undefined) {
      Object.assign(this, transacao);
    }
  }

  @PrimaryGeneratedColumn()
  id_transacao: number;

  @Column({ type: String, unique: false, nullable: true })
  dt_ordem: string;

  @Column({ type: String, unique: false, nullable: true })
  dt_pagamento: string;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nome_consorcio: string;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nome_operadora: string;

  @Column({ type: String, unique: false, nullable: true, length: 150 })
  servico: string;

  @Column({ type: Number, unique: true, nullable: true, length: 150 })
  id_ordem_ressarcimento: number;

  @Column({ type: Number, unique: false, nullable: true, length: 150 })
  qtde_transacao_rateio_credito: number;

  @Column({
    type: Number,
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  vlr_rateio_credito: number;

  @Column({ type: Number, unique: false, nullable: true, length: 150 })
  qtde_transacao_rateio_debito: number;

  @Column({
    type: Number,
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  vlr_rateio_debito: number;

  @Column({
    type: Number,
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  quantidade_total_transacao: number;

  @Column({ type: Number, unique: false, nullable: true })
  vlr_total_transacao_bruto: number;

  @Column({
    type: Number,
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  vlr_desconto_taxa: number;

  @Column({
    type: Number,
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  vlr_total_transacao_liquido: number;

  @Column({ type: Number, unique: false, nullable: true })
  qtde_total_transacao_captura: number;

  @Column({
    type: Number,
    unique: false,
    nullable: true,
    precision: 10,
    scale: 2,
  })
  vlr_total_transacao_captura: number;

  @Column({ type: String, unique: false, nullable: true, length: 100 })
  indicador_ordem_valida: string;

  @Column({ type: Number, unique: false, nullable: true })
  id_pagador: number;

  public getLogInfo(): string {
    const response = `#${this.id_transacao}`;
    return response;
  }
}
