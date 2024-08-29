import { Exclude, Expose, Transform } from 'class-transformer';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, BeforeInsert, BeforeUpdate, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LancamentoInputDto } from './dtos/lancamento-input.dto';

@Entity('lancamento')
export class Lancamento extends EntityHelper {
  constructor(lancamento?: DeepPartial<Lancamento>) {
    super();
    if (lancamento !== undefined) {
      Object.assign(this, lancamento);
    }
  }

  public static fromInputDto(dto: LancamentoInputDto) {
    return new Lancamento({
      descricao: dto.descricao,
      valor: dto.valor,
      data_ordem: new Date(dto.data_ordem),
      data_pgto: new Date(dto.data_pgto),
      data_lancamento: new Date(dto.data_lancamento),
      algoritmo: dto.algoritmo,
      glosa: dto.glosa,
      recurso: dto.recurso,
      anexo: dto.anexo,
      valor_a_pagar: dto.valor_a_pagar,
      numero_processo: dto.numero_processo,
      clienteFavorecido: { id: dto.id_cliente_favorecido },
      autor: dto.author,
    });
  }

  updateFromInputDto(dto: LancamentoInputDto) {
    this.descricao = dto.descricao;
    this.valor = dto.valor;
    this.data_ordem = dto.data_ordem;
    this.data_pgto = dto.data_pgto;
    this.data_lancamento = dto.data_lancamento;
    this.algoritmo = dto.algoritmo;
    this.glosa = dto.glosa;
    this.recurso = dto.recurso;
    this.anexo = dto.anexo;
    this.valor_a_pagar = dto.valor_a_pagar;
    this.numero_processo = dto.numero_processo;
    this.clienteFavorecido = new ClienteFavorecido({ id: dto.id_cliente_favorecido });
    this.autor = new User(dto.author);
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Lancamento_id' })
  id: number;

  @Column({ type: 'varchar' })
  descricao: string;

  /** Valor pago */
  @Column({ type: 'numeric' })
  valor: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_ordem: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_pgto: Date;

  /** createdAt */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_lancamento: Date;

  /** Remessa */
  @ManyToOne(() => Transacao, { nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Lancamento_transacao_ManyToOne' })
  transacao: Transacao;

  /**
   * Coluna - lista de User.id
   * @example `1,2,3`
   */
  @Exclude()
  @Column({ name: 'autorizado_por', type: 'varchar', nullable: true })
  autorizado_por: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_Lancamento_user_ManyToOne' })
  @Expose({ name: 'userId' })
  @Transform(({ value }) => (value as User).id)
  autor: User;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({ name: 'id_cliente_favorecido', foreignKeyConstraintName: 'FK_Lancamento_idClienteFavorecido_ManyToOne' })
  @Expose({ name: 'id_cliente_favorecido' })
  @Transform(({ value }) => (value as ClienteFavorecido).id)
  clienteFavorecido: ClienteFavorecido;

  @Column({ type: 'numeric', nullable: false })
  algoritmo: number;

  @Column({ type: 'numeric', nullable: false })
  glosa: number;

  @Column({ type: 'numeric', nullable: false })
  recurso: number;

  @Column({ type: 'numeric', nullable: false })
  anexo: number;

  @Column({ type: 'numeric', nullable: false })
  valor_a_pagar: number;

  @Column({ type: 'varchar', nullable: false })
  numero_processo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @AfterLoad()
  setReadValues() {
    this.glosa = asStringOrNumber(this.glosa);
    this.algoritmo = asStringOrNumber(this.algoritmo);
    this.recurso = asStringOrNumber(this.recurso);
    this.anexo = asStringOrNumber(this.anexo);
    this.valor_a_pagar = asStringOrNumber(this.valor_a_pagar);
  }

  getIsAutorizado() {
    const list = (this.autorizado_por || '').split(',');
    return list.length >= 2;
  }

  pushAutorizado(userId: number) {
    const list = (this.autorizado_por || '').split(',');
    list.push('' + userId);
    this.autorizado_por = list.join(',');
  }
}
