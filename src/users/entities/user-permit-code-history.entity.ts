import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EntityHelper } from 'src/utils/entity-helper';
import { User } from './user.entity';

/**
 * Códigos de permissão antigos de um usuário. Quando o `permitCode` do usuário é alterado,
 * o valor anterior é guardado aqui (com a data da troca) e continua vinculado ao mesmo usuário,
 * para que o sincronismo do BigQuery associe a ele as ordens emitidas com o código antigo.
 */
@Entity({ name: 'user_permit_code_history' })
export class UserPermitCodeHistory extends EntityHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: number;

  @Column({ name: 'permit_code', type: String })
  @Index()
  permitCode: string;

  /** Data em que o código foi arquivado (momento da troca). */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
