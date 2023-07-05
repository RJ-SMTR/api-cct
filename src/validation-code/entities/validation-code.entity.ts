import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  DeleteDateColumn,
  BeforeInsert,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Allow } from 'class-validator';
import { EntityHelper } from 'src/utils/entity-helper';
import { ValidationCodeDestination } from '../validation-code-destination/entities/validation-code-destination.entity';
import { ValidationCodeMethod } from '../validation-code-method/entities/validation-code-method.entity';
import { ValidationCodeDestinationEnum } from '../validation-code-destination/validation-code-destination.enum';
import { ValidationCodeMethodEnum } from '../validation-code-method/validation-code-method.enum';

@Entity()
export class ValidationCode extends EntityHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Allow()
  @Column()
  @Index()
  hash: string;

  @Allow()
  @ManyToOne(() => User, {
    eager: true,
  })
  user: User;

  @ManyToOne(() => ValidationCodeDestination, {
    eager: true,
  })
  destination: ValidationCodeDestination | ValidationCodeDestinationEnum;

  @ManyToOne(() => ValidationCodeMethod, {
    eager: true,
  })
  method: ValidationCodeMethod | ValidationCodeMethodEnum;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: Date, nullable: true })
  expiresAt: Date | null;

  @DeleteDateColumn()
  deletedAt: Date;

  @BeforeInsert()
  setDefaultExpiresAt() {
    // const expirationSeconds = 5 * 60;
    // this.expiresInSeconds = expirationSeconds;
    const expirationMinutes = 5;
    this.expiresAt = new Date(new Date().getTime() + expirationMinutes * 60000);
  }
}
