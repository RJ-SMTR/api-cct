import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import {
  Column,
  CreateDateColumn,
  DeepPartial,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoRecorrenciaEnum } from './tipo-recorrencia.enum';
import { RecorrenciaSemanaType } from 'src/cnab/const/recorrencia-semana.type';
import { Exclude } from 'class-transformer';

/**
 * AgendamentoPagamento
 *
 *
 */
@Entity()
export class AgendamentoPagamento extends EntityHelper {
  constructor(agendamento?: DeepPartial<AgendamentoPagamento>) {
    super();
    if (agendamento !== undefined) {
      Object.assign(this, agendamento);
    }
  }

  @PrimaryGeneratedColumn({
    primaryKeyConstraintName: 'PK_AgendamentoPagamento_id',
  })
  id: number;

  /** Pesquisar por dataInicio */
  @Column({ type: Date })
  dataOrdemInicio: Date;

  /** Pesquisar por dataFim */
  @Column({ type: Date })
  dataOrdemFim: Date;
  
  @Column({ type: Date })
  dataPagamento: Date;
  
  /** Se o agendamento se repete e qual o tipo de intervalo */
  @Column({ type: String })
  tipoRecorrencia: TipoRecorrenciaEnum;

  /** O agendamento se repete a cada N dias */
  @Column({ type: 'int', nullable: true, array: true })
  recorrenciaDias: number[];

  /** O agendamento se repete a cada seg, qua, sex etc. */
  @Column({ type: String, nullable: true, array: true })
  recorrenciaSemana: RecorrenciaSemanaType[];

  @ManyToMany(() => ClienteFavorecido, (favorecido) => favorecido.id, {
    eager: true,
  })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_DetalheAConf_ocorrencias_OneToMany',
  })
  clienteFavorecidos: ClienteFavorecido;

  /** Usuário que agendou o pagamento */
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_AgendamentoPagamento_user_ManyToOne',
  })
  user: User;

  @Column({ type: Boolean, nullable: false, default: false })
  isAtivo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Exclude()
  @DeleteDateColumn()
  deletedAt: Date;
}
