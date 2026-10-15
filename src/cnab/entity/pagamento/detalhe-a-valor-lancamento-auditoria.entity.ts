import { EntityHelper } from 'src/utils/entity-helper';
import { User } from 'src/users/entities/user.entity';
import { Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DetalheA } from './detalhe-a.entity';

@Entity()
export class DetalheAValorLancamentoAuditoria extends EntityHelper {
  constructor(dto?: DeepPartial<DetalheAValorLancamentoAuditoria>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_DetalheAValorLancamentoAuditoria_id' })
  id: number;

  @ManyToOne(() => DetalheA, { eager: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheAValorLancamentoAuditoria_detalheA_ManyToOne' })
  detalheA: DetalheA;

  @Column()
  detalheAId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_DetalheAValorLancamentoAuditoria_user_ManyToOne' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'decimal', unique: false, nullable: false, precision: 13, scale: 2 })
  valorAnterior: number;

  @Column({ type: 'decimal', unique: false, nullable: false, precision: 13, scale: 2 })
  valorNovo: number;

  @CreateDateColumn()
  createdAt: Date;
}
