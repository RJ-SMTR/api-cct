import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { User } from 'src/users/entities/user.entity';
import { Exclude, Expose } from 'class-transformer';
import { InviteStatus } from '../../invite-statuses/entities/invite-status.entity';

@Entity()
export class Invite extends BaseEntity {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @Allow()
  @ManyToOne(() => User, {
    eager: true,
  })
  user: User;

  @Column({ type: String })
  @Expose({ groups: ['me', 'admin'] })
  email: string;

  @Column({ unique: true })
  hash: string;

  @ManyToOne(() => InviteStatus, {
    eager: true,
  })
  inviteStatus: InviteStatus;

  @Column({ type: Number, nullable: true })
  smtpErrorCode?: number | null;

  @Column({ type: Number, nullable: true })
  httpErrorCode?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: Date, nullable: true })
  expiresAt: Date | null;

  @Column({ type: Date, nullable: true })
  failedAt?: Date | null;

  @Column({ type: Date, nullable: true })
  sentAt?: Date;

  @DeleteDateColumn()
  @Exclude()
  deletedAt: Date;
}
