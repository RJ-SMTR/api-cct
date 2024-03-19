import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('lancamento')
export class LancamentoEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  descricao: string;

  @Column({ type: 'numeric' })
  valor: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_ordem: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_pgto: Date;
  
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  data_lancamento: Date;

  @Column({ type: 'varchar', nullable: true })
  auth_usersIds?: string;

  @Column({ type: 'int', nullable: false })
  userId?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => ClienteFavorecido)
  @JoinColumn({ name: 'id_cliente_favorecido' })
  id_cliente_favorecido: ClienteFavorecido;

  @Column({ type: 'int', nullable: false })
  algoritmo: number;

  @Column({ type: 'numeric', nullable: false })
  glosa: number;

  @Column({ type: 'numeric', nullable: false })
  recurso: number;

  @Column({ type: 'int', nullable: false })
  valor_a_pagar: number;

  @Column({ type: 'string', nullable: false })
  numero_processo: string;
}
