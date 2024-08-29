import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrNumber } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
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

  /**
   * Coluna - lista de User.id
   * @example `1,2,3`
   */
  @Exclude()
  @Column({ name: 'autorizado_por', type: 'varchar', nullable: true })
  autorizado_por: string | null;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Lancamento_autor_ManyToOne' })
  @Expose({ name: 'userId' })
  @Transform(({ value }) => (value as User).id)
  autor: User;

  @ManyToOne(() => ClienteFavorecido, { eager: true })
  @JoinColumn({ name: 'id_cliente_favorecido', foreignKeyConstraintName: 'FK_Lancamento_idClienteFavorecido_ManyToOne' })
  @Expose({ name: 'id_cliente_favorecido' })
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
