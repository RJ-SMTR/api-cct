import {
  Column,
  AfterLoad,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  DeepPartial,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Status } from '../../statuses/entities/status.entity';
import { FileEntity } from '../../files/entities/file.entity';
import * as bcrypt from 'bcryptjs';
import { EntityHelper } from 'src/utils/entity-helper';
import { AuthProvidersEnum } from 'src/auth/auth-providers.enum';
import { Exclude, Expose } from 'class-transformer';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { Bank } from 'src/banks/entities/bank.entity';

@Entity()
export class User extends EntityHelper {
  newUser: User[];
  constructor(user?: User | DeepPartial<User>) {
    super();
    this.aux_bank = null;
    this.aux_inviteStatus = null;
    if (user !== undefined) {
      Object.assign(this, user);
    }
  }

  @PrimaryGeneratedColumn()
  id: number;

  // For "string | null" we need to use String type.
  // More info: https://github.com/typeorm/typeorm/issues/2567
  @Column({ type: String, unique: true, nullable: true })
  @Expose({ groups: ['me', 'admin'] })
  email: string | null;

  @Column({ nullable: true })
  @Exclude({ toPlainOnly: true })
  password: string;

  @Exclude({ toPlainOnly: true })
  public previousPassword: string;

  @AfterLoad()
  public loadPreviousPassword(): void {
    this.previousPassword = this.password;
  }

  @BeforeInsert()
  @BeforeUpdate()
  async setPassword() {
    if (this.previousPassword !== this.password && this.password) {
      const salt = await bcrypt.genSalt();
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  @Column({ default: AuthProvidersEnum.email })
  @Expose({ groups: ['me', 'admin'] })
  @Exclude({ toPlainOnly: true })
  provider: string;

  @Index()
  @Column({ type: String, nullable: true })
  @Expose({ groups: ['me', 'admin'] })
  @Exclude({ toPlainOnly: true })
  socialId: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  @Exclude({ toPlainOnly: true })
  firstName?: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  @Exclude({ toPlainOnly: true })
  lastName?: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  fullName?: string | null;

  @ManyToOne(() => FileEntity, {
    eager: true,
  })
  photo?: FileEntity | null;

  @ManyToOne(() => Role, {
    eager: true,
  })
  role?: Role | null;

  @ManyToOne(() => Status, {
    eager: true,
  })
  @Exclude({ toPlainOnly: true })
  status?: Status;

  @Column({ type: String, nullable: true })
  @Index()
  @Exclude({ toPlainOnly: true })
  hash: string | null;

  @CreateDateColumn()
  @Exclude({ toPlainOnly: true })
  createdAt: Date;

  @UpdateDateColumn()
  @Exclude({ toPlainOnly: true })
  updatedAt: Date;

  @DeleteDateColumn()
  @Exclude({ toPlainOnly: true })
  deletedAt: Date;

  @Column({ type: String, nullable: true })
  permitCode?: string;

  @Column({ type: String, nullable: true })
  cpfCnpj?: string;

  @Column({ type: Number, nullable: true })
  bankCode?: number;

  @Column({ type: String, nullable: true, length: 4 })
  bankAgency?: string;

  @Column({ type: String, nullable: true, length: 20 })
  bankAccount?: string;

  @Column({ type: String, nullable: true, length: 2 })
  bankAccountDigit?: string;

  @Column({ type: String, nullable: true })
  phone?: string;

  @Column({ type: Boolean, nullable: true })
  isSgtuBlocked?: boolean;

  @Column({ type: String, nullable: true })
  passValidatorId?: string;

  @Expose({ name: 'aux_isRegistrationComplete' })
  aux_isRegistrationComplete(): boolean {
    return (
      // non editable
      Boolean(this.cpfCnpj) &&
      Boolean(this.permitCode) &&
      Boolean(this.email) &&
      // editable
      Boolean(this.phone) &&
      Boolean(this.bankCode) &&
      Boolean(this.bankAgency) &&
      Boolean(this.bankAccount) &&
      Boolean(this.bankAccountDigit)
    );
  }

  @Expose({ name: 'aux_missingRegistrationFields' })
  aux_missingRegistrationFields(): string[] {
    const requiredFields: string[] = [
      // non editable
      'cpfCnpj',
      'permitCode',
      'email',
      'passValidatorId',
      // editable
      'phone',
      'bankCode',
      'bankAgency',
      'bankAccount',
      'bankAccountDigit',
    ];

    return requiredFields.filter(
      (field) =>
        !(typeof this[field] === 'boolean' || Boolean(this[field]) === true),
    );
  }

  aux_inviteStatus?: InviteStatus | null;

  aux_bank?: Bank | null;

  update(userProps: DeepPartial<User>) {
    Object.assign(this, userProps);
  }

  getLogInfo(showRole?: boolean): string {
    if (showRole === undefined) {
      showRole = true;
    }
    let response = '';
    if (this?.permitCode) {
      response += `#${this.permitCode}`;
    } else if (this?.email) {
      response += `'${this.email}'`;
    } else if (this?.id) {
      response += `#${this.id.toString()}`;
    } else {
      response += '[VAZIO]';
    }
    if (this?.role && showRole) {
      response += ` (${this.role.name})`;
    }
    return response;
  }
}
