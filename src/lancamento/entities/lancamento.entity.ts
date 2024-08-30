import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LancamentoInputDto } from '../dtos/lancamento-input.dto';
import { LancamentoAutorizacao } from './lancamento-autorizacao.entity';

export interface ILancamento {
  id: number;
  valor: number;
  data_ordem: Date;
  data_pgto: Date | null;
  data_lancamento: Date;
  transacao: Transacao;
  autorizacoes: User[];
  autor: User;
  clienteFavorecido: ClienteFavorecido;
  algoritmo: number;
  glosa: number;
  recurso: number;
  anexo: number;
  numero_processo: string;
  createdAt: Date;
  updatedAt: Date;
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
      anexo: dto.anexo,
      numero_processo: dto.numero_processo,
      clienteFavorecido: { id: dto.id_cliente_favorecido },
      autor: dto.author,
    });
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

  @Expose()
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Lancamento_id' })
  id: number;

  @ApiProperty({ description: 'Valor a pagar' })
  @Column({ type: 'numeric' })
  valor: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_ordem: Date;

  @Column({ type: 'timestamp', nullable: true })
  data_pgto: Date | null;

  /** createdAt */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_lancamento: Date;

  /** Remessa */
  @ApiProperty({ description: 'Transação do CNAB remessa associado a este Lançamento' })
  @ManyToOne(() => Transacao, { nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Lancamento_transacao_ManyToOne' })
  transacao: Transacao;

  @ManyToMany(() => User, (user) => user)
  @JoinTable({
    name: LancamentoAutorizacao.tableName,
    joinColumn: { name: 'lancamentoId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
    synchronize: false, // We use LancamentoAutorizacao to generate migration
  })
  @Expose({ name: 'autorizado_por' })
  @Transform(({ value }) =>
    (value as User[]).map((u) => ({
      id: u.id,
      nome: u.fullName,
    })),
  )
  autorizacoes: User[];

  /** O autor mais recente da criação/modificação/autorização do Lançamento */
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Lancamento_autor_ManyToOne' })
  @Expose({ name: 'userId' })
  @Transform(({ value }) => (value as User).id)
  autor: User;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({ name: 'id_cliente_favorecido', foreignKeyConstraintName: 'FK_Lancamento_idClienteFavorecido_ManyToOne' })
  // @Expose({ name: 'id_cliente_favorecido' })
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

  // @Column({ type: 'numeric', nullable: false })
  // valor_a_pagar: number;

  @Column({ type: 'varchar', nullable: false })
  numero_processo: string;

  @Column({ type: Boolean, nullable: false, default: false })
  is_autorizado: boolean;

  @Exclude()
  @CreateDateColumn()
  createdAt: Date;

  @Exclude()
  @UpdateDateColumn()
  updatedAt: Date;

  @AfterLoad()
  setReadValues() {
    this.glosa = asStringOrNumber(this.glosa);
    this.algoritmo = asStringOrNumber(this.algoritmo);
    this.recurso = asStringOrNumber(this.recurso);
    this.anexo = asStringOrNumber(this.anexo);
    this.valor = asStringOrNumber(this.valor);
    this.autorizacoes = this.autorizacoes || [];
  }

  getIsAutorizado(): boolean {
    return this.is_autorizado;
  }

  addAutorizado(userId: number) {
    this.autorizacoes.push({ id: userId } as User);
    this.is_autorizado = this.autorizacoes.length >= 2;
  }

  removeAutorizado(userId: number) {
    this.autorizacoes = this.autorizacoes.filter((u) => u.id != userId);
    this.is_autorizado = this.autorizacoes.length >= 2;
  }

  hasAutorizadoPor(userId: number): boolean {
    return Boolean(this.autorizacoes.find((u) => u.id == userId));
  }
}
