import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrdemPagamentoAgrupado } from './ordem-pagamento-agrupado.entity';

@Entity()
export class OrdemPagamento extends EntityHelper {
  constructor(dto?: DeepPartial<OrdemPagamento>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  /** id_ordem_pagamento_consorcio_operador_dia */
  @PrimaryColumn({ primaryKeyConstraintName: 'PK_OrdemPagamentoId' })
  id: number;

  // @Column({ type: Number, unique: true, nullable: false })
  // bqId: number;

  /**
   * Data em que o pagamento foi feito com sucesso. Se não foi feito o pagamento, valor é `null`.
   * Obtida do Bigquery no formato: `yyyy-mm-dd`, salva como Date para facilitar a consulta e padronização.
   */
  @Column({ type: 'date', unique: false, nullable: false })
  dataOrdem: Date;

  /** Normalmente nunca vem `null`. Caso venha, o sistema está preparado. */
  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeConsorcio: string | null;

  /** Normalmente nunca vem `null`. Caso venha, o sistema está preparado. */
  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeOperadora: string | null;

  /** Para simplificação, apenas salvamos o id do User, sem relacionamento. */
  @Column({ type: Number, unique: false, nullable: false })
  userId: number;

  /** No Bigquery é nullable mas ignoramos nulos ou zerados no remessa. */
  @Column({
    type: 'decimal',
    unique: false,
    nullable: false,
    precision: 13,
    scale: 5,
  })
  valor: number;

  @Column({ type: String, unique: false, nullable: true })
  idOrdemPagamento: string;

  /** No bigquery é nullable, mas normalmente não vé `null` */
  @Column({ type: String, unique: false, nullable: true })
  idOperadora: string | null;

  /** CPF/CNPJ do favorecido (vanzeiro ou empresa) */
  @Column({ type: String, unique: false, nullable: true })
  operadoraCpfCnpj: string | null;

  /** CNPJ da empresa */
  @Column({ type: String, unique: false, nullable: true })
  idConsorcio: string | null;

  /** CPF/CNPJ do favorecido (vanzeiro ou empresa) */
  @Column({ type: String, unique: false, nullable: true })
  consorcioCnpj: string | null;

  @ManyToOne(() => OrdemPagamentoAgrupado, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_OrdemPagamentoAgrupado_ManyToOne' })
  ordemPgamentoAgrupado: OrdemPagamentoAgrupado;

  /**
   *
   */
  @Column({ type: Date, unique: false, nullable: false })
  bqUpdatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @AfterLoad()
  setReadValues() {
    this.valor = asStringOrNumber(this.valor);
  }
}
