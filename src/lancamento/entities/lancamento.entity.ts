import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
import { ItemTransacao } from 'src/cnab/entity/pagamento/item-transacao.entity';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, DeleteDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LancamentoStatus } from '../enums/lancamento-status.enum';
import { LancamentoInputDto } from '../dtos/lancamento-input.dto';
import { LancamentoAutorizacao } from './lancamento-autorizacao.entity';

export interface ILancamento {
  id: number;
  valor: number;
  data_ordem: Date;
  data_pgto: Date | null;
  data_lancamento: Date;
  itemTransacao: ItemTransacao | null;
  autorizacoes: User[];
  autor: User;
  clienteFavorecido: ClienteFavorecido;
  algoritmo: number;
  glosa: number;
  recurso: number;
  anexo: number;
  numero_processo: string;
  is_autorizado: boolean;
  is_pago: boolean;
  status: LancamentoStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
}

@Entity('lancamento')
export class Lancamento extends EntityHelper implements ILancamento {
  constructor(lancamento?: DeepPartial<Lancamento>) {
    super();
    if (lancamento !== undefined) {
      Object.assign(this, lancamento);
    }
  }

  public static fromInputDto(dto: LancamentoInputDto) {
    return new Lancamento({
      valor: dto.valor,
      data_ordem: dto.data_ordem,
      data_lancamento: dto.data_lancamento,
      algoritmo: dto.algoritmo,
      glosa: dto.glosa,
      recurso: dto.recurso,
      anexo: dto.anexo || 0,
      numero_processo: dto.numero_processo,
      clienteFavorecido: { id: dto.id_cliente_favorecido },
      autor: dto.author,
    });
  }

  @Expose()
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Lancamento_id' })
  id: number;

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
   * uniqueConstraintName: `UQ_Lancamento_itemTransacao`
   */
  @Exclude()
  @ApiProperty({ description: 'ItemTransação do CNAB remessa associado a este Lançamento' })
  @OneToOne(() => ItemTransacao, { nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Lancamento_itemTransacao_OneToOne' })
  @Transform(({ value }) => (!value ? null : ((it = value as ItemTransacao) => ({ id: it.id, itemTransacaoAgrupado: { id: it.itemTransacaoAgrupado.id } }))()))
  itemTransacao: ItemTransacao | null;

  @ManyToMany(() => User, (user) => user)
  @JoinTable({
    name: LancamentoAutorizacao.tableName,
    joinColumn: { name: 'lancamentoId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
    synchronize: false, // We use LancamentoAutorizacao to generate migration
  })
  @Expose({ name: 'autorizado_por' })
  @Transform(({ value }) => (value as User[]).map((u) => ({ id: u.id, nome: u.fullName })))
  autorizacoes: User[];

  /** O autor mais recente da criação/modificação/autorização do Lançamento */
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Lancamento_autor_ManyToOne' })
  @Transform(({ value }) => ({ id: (value as User).id, fullName: (value as User).fullName } as DeepPartial<User>))
  autor: User;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({ name: 'id_cliente_favorecido', foreignKeyConstraintName: 'FK_Lancamento_idClienteFavorecido_ManyToOne' })
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

  @Column({ type: 'varchar', nullable: false })
  numero_processo: string;

  @Column({ type: Boolean, nullable: false, default: false })
  is_autorizado: boolean;

  @Column({ type: Boolean, nullable: false, default: false })
  is_pago: boolean;

  /** Uma forma de rastrear o estado atual do Lancamento */
  @Column({ enum: LancamentoStatus, nullable: false, default: LancamentoStatus._1_criado })
  status: LancamentoStatus;

  @Exclude()
  @CreateDateColumn()
  createdAt: Date;

  @Exclude()
  @UpdateDateColumn()
  updatedAt: Date;

  /** Como são dados de pagamento, caso se delete um Lançamento o dado permanece no banco para auditoria */
  @DeleteDateColumn()
  @Exclude()
  deletedAt: Date;

  /** Coluna virtual */
  @Exclude()
  @Transform(({ value }) => (value === null ? null : ((da = value as DetalheA) => ({ id: da.id, ocorrenciasCnab: da.ocorrenciasCnab, numeroDocumentoEmpresa: da.numeroDocumentoEmpresa }))()))
  detalheA: DetalheA | null = null;

  /** Coluna virtual - para consultar as ocorrências */
  ocorrencias: Ocorrencia[] = [];

  @AfterLoad()
  setReadValues() {
    this.glosa = asStringOrNumber(this.glosa);
    this.algoritmo = asStringOrNumber(this.algoritmo);
    this.recurso = asStringOrNumber(this.recurso);
    this.anexo = asStringOrNumber(this.anexo);
    this.valor = asStringOrNumber(this.valor);
    this.autorizacoes = this.autorizacoes || [];
    // if (this.itemTransacao?.itemTransacaoAgrupado.de)
  }

  getIsAutorizado(): boolean {
    return this.is_autorizado;
  }

  addAutorizado(userId: number) {
    this.autorizacoes.push({ id: userId } as User);
    this.is_autorizado = this.autorizacoes.length >= 2;
    if (this.status === LancamentoStatus._1_criado && this.is_autorizado) {
      this.status = LancamentoStatus._2_autorizado;
    }
  }

  removeAutorizado(userId: number) {
    this.autorizacoes = this.autorizacoes.filter((u) => u.id != userId);
    this.is_autorizado = this.autorizacoes.length >= 2;
  }

  hasAutorizadoPor(userId: number): boolean {
    return Boolean(this.autorizacoes.find((u) => u.id == userId));
  }

  updateFromInputDto(dto: LancamentoInputDto) {
    this.valor = dto.valor;
    this.data_ordem = dto.data_ordem;
    this.data_lancamento = dto.data_lancamento;
    this.algoritmo = dto.algoritmo;
    if (dto.glosa !== undefined) {
      this.glosa = dto.glosa;
    }
    if (dto.recurso !== undefined) {
      this.recurso = dto.recurso;
    }
    if (dto.anexo !== undefined) {
      this.anexo = dto.anexo;
    }
    this.valor = dto.valor;
    this.numero_processo = dto.numero_processo;
    this.clienteFavorecido = new ClienteFavorecido({ id: dto.id_cliente_favorecido });
    this.autor = new User(dto.author);
  }

  public static getSqlFields(table?: string, castType?: boolean): Record<keyof ILancamento, string> {
    return {
      id: `${table ? `${table}.` : ''}"id"`,
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
      deletedAt: `${table ? `${table}.` : ''}"deletedAt"`, // Date,
    };
  }

  public static sqlFieldTypes: Record<keyof ILancamento, string> = {
    id: 'INT',
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
    deletedAt: 'TIMESTAMP',
  };
}
