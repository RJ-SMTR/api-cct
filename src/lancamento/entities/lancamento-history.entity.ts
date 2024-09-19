import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { ItemTransacao } from 'src/cnab/entity/pagamento/item-transacao.entity';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LancamentoStatus } from '../enums/lancamento-status.enum';
import { ILancamentoBase, Lancamento } from './lancamento.entity';

export type TLancamentoHistory = {
  lancamento: Lancamento;
} & ILancamentoBase;

@Entity('lancamento_history')
export class LancamentoHistory extends EntityHelper implements TLancamentoHistory {
  constructor(lancamento?: DeepPartial<LancamentoHistory>) {
    super();
    if (lancamento !== undefined) {
      Object.assign(this, lancamento);
    }
  }

  public static fromLancamento(l: Lancamento, setAutorizacoes: boolean) {
    return new LancamentoHistory({
      lancamento: { id: l.id },
      valor: l.valor,
      data_ordem: l.data_ordem,
      data_pgto: l.data_pgto,
      data_lancamento: l.data_lancamento,
      itemTransacao: l.itemTransacao,
      ...(setAutorizacoes ? { autorizacoes: l.autorizacoes } : {}),
      autor: l.autor,
      clienteFavorecido: { id: l.clienteFavorecido.id },
      algoritmo: l.algoritmo,
      glosa: l.glosa,
      recurso: l.recurso,
      anexo: l.anexo,
      numero_processo: l.numero_processo,
      is_autorizado: l.is_autorizado,
      is_pago: l.is_pago,
      status: l.status,
      motivo_cancelamento: l.motivo_cancelamento,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    });
  }

  @Expose()
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_LancamentoHistory_id' })
  id: number;

  @Expose()
  @ManyToOne(() => Lancamento, { nullable: false, eager: false, onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoHistory_lancamento_ManyToOne' })
  lancamento: Lancamento;

  @ApiProperty({ description: 'Valor a pagar' })
  @Column({ type: 'numeric' })
  valor: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_ordem: Date;

  /** Data da ordem baseada no valor da dataOrdem no front */
  @Column({ type: 'timestamp', nullable: true })
  data_pgto: Date | null;

  /**
   * Data usada meramente para registro, baseado na seleção dos parâmetros no front.
   *
   * Mesmo se a dataOrdem for alterada a dataLancamento permanece igual.
   *
   * @examples
   * - Mês: agosto, período: 1, ano: 2024 = 2024/08/01
   * - Mês: agosto, período: 2, ano: 2024 = 2024/08/16
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_lancamento: Date;

  /**
   * Geração de Remessa
   *
   * uniqueConstraintName: `UQ_LancamentoHistory_itemTransacao`
   */
  @Exclude()
  @ApiProperty({ description: 'ItemTransação do CNAB remessa associado a este Lançamento' })
  @OneToOne(() => ItemTransacao, { nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoHistory_itemTransacao_OneToOne' })
  @Transform(({ value }) => (!value ? null : ((it = value as ItemTransacao) => ({ id: it.id, itemTransacaoAgrupado: { id: it.itemTransacaoAgrupado.id } }))()))
  itemTransacao: ItemTransacao | null;

  @ManyToMany(() => User, (user) => user)
  @JoinTable({
    name: 'lancamento_autorizacao_history',
    joinColumn: { name: 'lancamentoHistoryId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
    synchronize: false, // We use LancamentoAutorizacaoHistory to generate migration
  })
  @Expose({ name: 'autorizado_por' })
  @Transform(({ value }) => (value as User[]).map((u) => ({ id: u.id, nome: u.fullName })))
  autorizacoes: User[];

  /** O autor mais recente da criação/modificação/autorização do Lançamento */
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_LancamentoHistory_autor_ManyToOne' })
  @Transform(({ value }) => ({ id: (value as User).id, fullName: (value as User).fullName } as DeepPartial<User>))
  autor: User;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({ name: 'id_cliente_favorecido', foreignKeyConstraintName: 'FK_LancamentoHistory_idClienteFavorecido_ManyToOne' })
  @Transform(({ value }) => ({
    id: (value as ClienteFavorecido).id,
    nome: (value as ClienteFavorecido).nome,
  }))
  clienteFavorecido: ClienteFavorecido;

  @Column({ type: 'numeric', nullable: false })
  algoritmo: number;

  @Column({ type: 'numeric', nullable: false, default: 0 })
  glosa: number;

  @Column({ type: 'numeric', nullable: false, default: 0 })
  recurso: number;

  @Column({ type: 'numeric', nullable: false, default: 0 })
  anexo: number;

  @Column({ type: String, nullable: false })
  numero_processo: string;

  /** Quando 2 pessoas autorizam, o Lançamento está autorizado, pronto para enviar o remessa */
  @Column({ type: Boolean, nullable: false, default: false })
  is_autorizado: boolean;

  @Column({ type: Boolean, nullable: false, default: false })
  is_pago: boolean;

  /** Uma forma de rastrear o estado atual do Lancamento */
  @Column({ enum: LancamentoStatus, nullable: false, default: LancamentoStatus._1_gerado })
  status: LancamentoStatus;

  @Column({ type: String, nullable: true })
  motivo_cancelamento: string | null;

  /** Lancamento.createdAt */
  @Column({ type: Date, nullable: false })
  createdAt: Date;

  /** Lancamento.updatedAt */
  @Column({ type: Date, nullable: false })
  updatedAt: Date;

  /** Data de criação deste histórico */
  @CreateDateColumn()
  backupAt: Date;

  /** Coluna virtual */
  @Exclude()
  @Transform(({ value }) => (value === null ? null : ((da = value as DetalheA) => ({ id: da.id, ocorrenciasCnab: da.ocorrenciasCnab, numeroDocumentoEmpresa: da.numeroDocumentoEmpresa }))()))
  detalheA: DetalheA | null = null;

  /** Coluna virtual - para consultar as ocorrências */
  ocorrencias: Ocorrencia[] = [];

  public static getSqlFields(table?: string, castType?: boolean): Record<keyof TLancamentoHistory, string> {
    return {
      id: `${table ? `${table}.` : ''}"id"`,
      lancamento: `${table ? `${table}.` : ''}"lancamentoId"`,
      valor: `${table ? `${table}.` : ''}"valor"`, // number,
      data_ordem: `${table ? `${table}.` : ''}"data_ordem"`, // Date,
      data_pgto: `${table ? `${table}.` : ''}"data_pgto"`, // Date | null,
      data_lancamento: `${table ? `${table}.` : ''}"data_lancamento"`, // Date,
      itemTransacao: `${table ? `${table}.` : ''}"itemTransacao"`, // ItemTransacao,
      autorizacoes: `${table ? `${table}.` : ''}"autorizacoes"`, // User[],
      autor: `${table ? `${table}.` : ''}"autor"`, // User,
      clienteFavorecido: `${table ? `${table}.` : ''}"clienteFavorecido"`, // ClienteFavorecido,
      algoritmo: `${table ? `${table}.` : ''}"algoritmo"`, // number,
      glosa: `${table ? `${table}.` : ''}"glosa"`, // number,
      recurso: `${table ? `${table}.` : ''}"recurso"`, // number,
      anexo: `${table ? `${table}.` : ''}"anexo"`, // number,
      numero_processo: `${table ? `${table}.` : ''}"numero_processo"`, // string,
      is_autorizado: `${table ? `${table}.` : ''}"is_autorizado"`, // boolean,
      is_pago: `${table ? `${table}.` : ''}"is_pago"`, // boolean,
      status: `${table ? `${table}.` : ''}"status"`, // string,
      createdAt: `${table ? `${table}.` : ''}"createdAt"`, // Date,
      updatedAt: `${table ? `${table}.` : ''}"updatedAt"`, // Date,
    };
  }

  public static sqlFieldTypes: Record<keyof TLancamentoHistory, string> = {
    id: 'INT',
    lancamento: 'INT',
    valor: 'NUMERIC',
    data_ordem: 'TIMESTAMP',
    data_pgto: 'TIMESTAMP',
    data_lancamento: 'TIMESTAMP',
    itemTransacao: 'INT',
    autorizacoes: '',
    autor: '',
    clienteFavorecido: '',
    algoritmo: 'NUMERIC',
    glosa: 'NUMERIC',
    recurso: 'NUMERIC',
    anexo: 'NUMERIC',
    numero_processo: 'VARCHAR',
    is_pago: 'BOOLEAN',
    is_autorizado: 'BOOLEAN',
    status: 'VARCHAR',
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  };
}
