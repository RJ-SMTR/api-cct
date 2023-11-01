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
import { InviteStatusEnum } from 'src/invite-statuses/invite-status.enum';

@Entity('invite')
export class MailHistory extends BaseEntity {
  constructor(invite?: MailHistory) {
    super();
    if (invite !== undefined) {
      Object.assign(this, invite);
    }
  }

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

  public getInviteStatus(): InviteStatusEnum {
    return InviteStatusEnum[this.inviteStatus.name as keyof InviteStatusEnum];
  }

  public setInviteStatus(inviteStatus: InviteStatusEnum) {
    this.inviteStatus = new InviteStatus(inviteStatus);
  }

  /**
   * Sets errors and updates `failedAt`
   */
  public setInviteError(args: {
    smtpErrorCode?: number | null;
    httpErrorCode?: number | null;
  }) {
    if (args.smtpErrorCode === undefined && args.httpErrorCode === undefined) {
      return;
    }
    if (args.smtpErrorCode !== undefined) {
      this.smtpErrorCode = args.smtpErrorCode;
    }
    if (args.httpErrorCode !== undefined) {
      this.httpErrorCode = args.httpErrorCode;
    }
    if (this.smtpErrorCode === null && this.httpErrorCode === null) {
      this.failedAt = null;
    } else {
      this.failedAt = new Date(Date.now());
    }
  }

  public getUpdatedAt(): Date {
    return this.failedAt ? this.failedAt : this.createdAt;
  }
}
