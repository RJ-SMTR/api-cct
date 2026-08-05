import { EntityHelper } from 'src/utils/entity-helper';
import { asNullableStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { Exclude } from 'class-transformer';
import { nextFriday, nextThursday, startOfDay } from 'date-fns';
import { OrdemPagamentoDto } from 'src/cnab/dto/pagamento/ordem-pagamento.dto';
import { yearMonthDayToDate } from 'src/utils/date-utils';
import { ItemTransacao } from './item-transacao.entity';
import { TransacaoAgrupado } from './transacao-agrupado.entity';

/**
 * Representa um destinatário, a ser pago pelo remetente (TransacaoAgrupado).
 *
 * Esta tabela contém a soma de todas as transações (ItemTransacao)
 * a serem feitas neste CNAB (TransacaoAgrupado).
 *
 * Colunas:
 * - dataOrdem: sexta de pagamento (baseado no BigqueryOrdemPgto.dataOrdem (dia da ordem D+1))
 *
 * Identificador:
 *   - TransacaoAgrupado (CNAB / remetente)
 *   - ClienteFavorecido (destinatário)
 */
@Entity()
export class ItemTransacaoAgrupado extends EntityHelper {
  @Exclude()
  private readonly FKs = ['transacaoAgrupado', 'clienteFavorecido'];

  constructor(dto?: DeepPartial<ItemTransacaoAgrupado>) {
    super();
    if (dto) {
      Object.assign(this, dto);
      this.setReadValues();
      if (this?.transacaoAgrupado) {
        this.transacaoAgrupado = new TransacaoAgrupado(dto.transacaoAgrupado);
      }
    }
  }

  public static fromOrdem(ordem: OrdemPagamentoDto, transacaoAg: TransacaoAgrupado) {
    const fridayOrdem = nextFriday(nextThursday(startOfDay(yearMonthDayToDate(ordem.dataOrdem))));
    const item = new ItemTransacaoAgrupado({
      dataOrdem: ordem.lancamento ? ordem.dataOrdem : fridayOrdem,
      idConsorcio: ordem.idConsorcio,
      idOperadora: ordem.idOperadora,
      idOrdemPagamento: ordem.idOrdemPagamento,
      nomeConsorcio: ordem.consorcio,
      nomeOperadora: ordem.operadora,
      valor: ordem.valorTotalTransacaoLiquido,
      transacaoAgrupado: transacaoAg,
    });
    return item;
  }

  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_ItemTransacaoAgrupado_id',
  })
  id: number;

  @ManyToOne(() => TransacaoAgrupado, {
    eager: true,
  })    
  transacaoAgrupado: TransacaoAgrupado;

  @CreateDateColumn()
  dataProcessamento: Date;

  /** TODO: remover, não usaremos mais pois já tem o createdAt - Ao gravar pegamos dataOrdem */
  @CreateDateColumn()
  dataCaptura: Date;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeConsorcio: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  nomeOperadora: string | null;

  /**
   * Valor do lançamento.
   */
  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 13,
    scale: 5,
  })
  valor: number;

  // Unique columns Jaé

  @Column({ type: String, unique: false, nullable: true })
  idOrdemPagamento: string | null;

  /** CPF. */
  @Column({ type: String, unique: false, nullable: true })
  idOperadora: string | null;

  /** CNPJ */
  @Column({ type: String, unique: false, nullable: true })
  idConsorcio: string | null;

  // Unique columns Lancamento

  /** Data em que será feito o apgamento. (também vem do bigquery) */
  @Column({ type: Date, unique: false, nullable: false })
  dataOrdem: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Não é uma coluna, usado apenas para consulta no ORM. */
  @OneToMany(() => ItemTransacao, (it) => it.itemTransacaoAgrupado)
  itemTransacoes: ItemTransacao[];

  public getLogInfo(): string {
    return `#{ idOP: ${this.idOrdemPagamento}, op: ${this.idOperadora}, co: ${this.idConsorcio} }`;
  }

  public static getUniqueIdJae(entity: DeepPartial<ItemTransacaoAgrupado>): string {
    return `${entity.idOrdemPagamento}|${entity.idConsorcio}|${entity.idOperadora}`;
  }

  @AfterLoad()
  setReadValues() {
    (this.valor as string | number | null) = asNullableStringOrNumber(this.valor);
  }
}
