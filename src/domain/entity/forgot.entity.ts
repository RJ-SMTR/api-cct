import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  DeleteDateColumn,
  JoinColumn,
} from 'typeorm';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { User } from './user.entity';

@Entity()
export class Forgot extends EntityHelper {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Forgot_id' })
  id: number;

  /** indexName: `IDX_Forgot_hash` */
  @Allow()
  @Column()
  @Index('IDX_Forgot_hash')
  hash: string;

  @Allow()
  @ManyToOne(() => User, {
    eager: true,
  })
  @JoinColumn({ foreignKeyConstraintName: 'FK_Forgot_user_ManyToOne' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
