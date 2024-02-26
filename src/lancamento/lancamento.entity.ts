import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

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

  @Column({ type: 'varchar', nullable: true })
  auth_usersIds?: string;

  @Column({ type: 'int', nullable: true })
  userId?: number;
}
