import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { Allow } from 'class-validator';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { User } from 'src/users/entities/user.entity';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('invite')
export class MailHistory extends BaseEntity {
  constructor(mailHistory?: Partial<MailHistory>) {
    super();
    if (mailHistory !== undefined) {
      Object.assign(this, mailHistory);
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
  sentAt?: Date | null;

  @DeleteDateColumn()
  @Exclude()
  deletedAt: Date;

  public static getColumns() {
    return {
      inviteStatus: 'inviteStatusId',
    };
  }

  public getMailStatus(): InviteStatusEnum {
    return InviteStatusEnum[this.inviteStatus.name as keyof InviteStatusEnum];
  }

  public setInviteStatus(inviteStatus: InviteStatusEnum) {
    this.inviteStatus = new InviteStatus(inviteStatus);
  }

  /**
   * Set errors and updates `failedAt`
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

  getLogInfoStr(): string {
    let response = '';
    if (this?.email) {
      response += `'${this.email}'`;
    } else if (this?.id) {
      response += `#${this.id.toString()}`;
    } else {
      response += '[VAZIO]';
    }
    const details: any = {};
    if (this?.user) {
      details.user = new User(this.user).getLogInfo(false);
    }
    if (this?.inviteStatus) {
      details.inviteStatus = new InviteStatus(this.inviteStatus).name;
    }
    if (Object.keys(details).length > 0) {
      response += ` ${JSON.stringify(details)}`;
    }
    return response;
  }
}
