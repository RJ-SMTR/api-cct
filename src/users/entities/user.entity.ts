import { HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Exclude, Expose } from 'class-transformer';
import { AuthProvidersEnum } from 'src/auth/domain/enums/auth-providers.enum';
import { Bank } from 'src/banks/entities/bank.entity';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { AfterLoad, BeforeInsert, BeforeUpdate, Column, CreateDateColumn, DeepPartial, DeleteDateColumn, Entity, Index, JoinColumn, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { FileEntity } from '../../files/entities/file.entity';
import { Role } from '../../roles/entities/role.entity';
import { Status } from '../../statuses/entities/status.entity';
import { UserHttpException } from 'src/utils/http-exception/user-http-exception';
import { Lancamento } from 'src/lancamento/entities/lancamento.entity';

/** uniqueConstraintName: `UQ_User_email` */
@Entity()
export class User extends EntityHelper {
  newUser: User[];
  constructor(user?: DeepPartial<User>) {
    super();
    this.aux_bank = null;
    this.aux_inviteStatus = null;
    if (user !== undefined) {
      Object.assign(this, user);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_User_id' })
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

  /**
   * Password to update in database.
   *
   * If new password exists, get hashed password.
   * If not, return undefined.
   */
  async parseNewPassword(newPassword?: string): Promise<string | undefined> {
    if (this.previousPassword !== newPassword && newPassword) {
      const salt = await bcrypt.genSalt();
      return await bcrypt.hash(newPassword, salt);
    }
    return undefined;
  }

  @Column({ default: AuthProvidersEnum.email })
  @Expose({ groups: ['me', 'admin'] })
  @Exclude({ toPlainOnly: true })
  provider: string;

  @Index('IDX_User_socialId')
  @Column({ type: String, nullable: true })
  @Expose({ groups: ['me', 'admin'] })
  @Exclude({ toPlainOnly: true })
  socialId: string | null;

  @Index('IDX_User_firstName')
  @Column({ type: String, nullable: true })
  @Exclude({ toPlainOnly: true })
  firstName?: string | null;

  @Index('IDX_User_lastName')
  @Column({ type: String, nullable: true })
  @Exclude({ toPlainOnly: true })
  lastName?: string | null;

  @Index('IDX_User_fullName')
  @Column({ type: String, nullable: true })
  fullName?: string | null;

  photo?: FileEntity | null;

  @ManyToOne(() => Role, {
    eager: true,
  })
  @JoinColumn({ foreignKeyConstraintName: 'FK_User_role_ManyToOne' })
  role?: Role | null;

  @ManyToOne(() => Status, {
    eager: true,
  })
  @JoinColumn({ foreignKeyConstraintName: 'FK_User_status_ManyToOne' })
  @Exclude({ toPlainOnly: true })
  status?: Status;

  @Column({ type: String, nullable: true })
  @Index('IDX_User_hash')
  @Exclude({ toPlainOnly: true })
  hash: string | null;

  @CreateDateColumn()
  //@Exclude({ toPlainOnly: true })
  createdAt: Date;

  @Column()
  //@Exclude({ toPlainOnly: true })
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

  @Column({ type: String, nullable: true, length: 5 })
  bankAgency?: string;

  @Column({ type: String, nullable: true, length: 20 })
  bankAccount?: string;

  @Column({ type: String, nullable: true, length: 2 })
  bankAccountDigit?: string;

  @Column({ type: String, nullable: true })
  phone?: string;

  @Column({ type: Boolean, nullable: true })
  isSgtuBlocked?: boolean;
  
  @Column({ type: Boolean, nullable: true })
  bloqueado?: boolean;

  @Column({ type: String, nullable: true })
  passValidatorId?: string;

  @Column({ type: Number, nullable: true })
  previousBankCode?: number;
  
  @ManyToMany(() => Lancamento, (lancamento) => lancamento)
  lancamentos: Lancamento[];

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

    return requiredFields.filter((field) => !(typeof this[field] === 'boolean' || Boolean(this[field]) === true));
  }

  @OneToMany(() => MailHistory, (mailHistory) => mailHistory.user.id, {
    createForeignKeyConstraints: false,
    // lazy: true,
  })
  @Exclude()
  public mailHistories: MailHistory[];

  @Exclude()
  public __mailHistories__: MailHistory[];

  @Exclude()
  public __has_mailHistories__ = false;

  aux_inviteStatus?: InviteStatus | null;

  @Exclude()
  aux_inviteHash?: string | null;

  aux_bank?: Bank | null;

  /**
   *
   * @param userProps Properties to update
   * @param removeConstraintKeys remove redundant keys to avoid database update
   */
  update(userProps: DeepPartial<User>, asUpdateObject = false) {
    const props = new User(userProps);
    if (asUpdateObject) {
      if (props?.email === this?.email) {
        (props.email as any) = undefined;
      }
      if (props?.password === undefined || props?.password === this.password) {
        (props.password as any) = undefined;
      }
    }
    (this.mailHistories as any) = undefined;
    Object.assign(this, props);
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

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getBankAgency(args?: { errorMessage?: string; httpStatusCode?: HttpStatus }): string {
    if (!this.bankAgency) {
      throw UserHttpException.invalidField('bankAgency', {
        errorMessage: args?.errorMessage,
        httpStatusCode: args?.httpStatusCode,
      });
    }
    return this.bankAgency;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getBankAgencyWithoutDigit(args?: { errorMessage?: string; httpStatusCode?: HttpStatus }): string {
    const agency = this.getBankAgency(args);
    return agency.substring(0, agency.length - 1);
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getBankAgencyDigit(args?: { errorMessage?: string; httpStatusCode?: HttpStatus }): string {
    const agency = this.getBankAgency(args);
    return agency.substring(agency.length - 1);
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getBankAccount(args?: { errorMessage?: string; httpStatusCode?: HttpStatus }): string {
    if (!this.bankAccount) {
      throw UserHttpException.invalidField('bankAgency', {
        errorMessage: args?.errorMessage,
        httpStatusCode: args?.httpStatusCode,
      });
    }
    return this.bankAccount;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getBankAccountDigit(args?: { errorMessage?: string; httpStatusCode?: HttpStatus }): string {
    if (!this.bankAccountDigit) {
      throw UserHttpException.invalidField('bankAgency', {
        errorMessage: args?.errorMessage,
        httpStatusCode: args?.httpStatusCode,
      });
    }
    return this.bankAccountDigit;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getBankCode(args?: { errorMessage?: string; httpStatusCode?: HttpStatus }): number {
    if (!this.bankCode) {
      throw UserHttpException.invalidField('bankAgency', {
        errorMessage: args?.errorMessage,
        httpStatusCode: args?.httpStatusCode,
      });
    }
    return this.bankCode;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getFullName(args?: { errorMessage?: string; httpStatusCode?: HttpStatus }): string {
    if (!this.fullName) {
      throw UserHttpException.invalidField('fullName', {
        errorMessage: args?.errorMessage,
        httpStatusCode: args?.httpStatusCode,
      });
    }
    return this.fullName;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getCpfCnpj(args?: { errorMessage?: string; httpStatusCode?: HttpStatus }): string {
    if (!this.cpfCnpj) {
      throw UserHttpException.invalidField('cpfCnpj', {
        errorMessage: args?.errorMessage,
        httpStatusCode: args?.httpStatusCode,
      });
    }
    return this.cpfCnpj;
  }

  /**
   * Get field validated
   * @throws `HttpException`
   */
  getPermitCode(args?: { errorMessage?: string; httpStatusCode?: HttpStatus }): string {
    if (!this.permitCode) {
      throw UserHttpException.invalidField('permitCode', {
        errorMessage: args?.errorMessage,
        httpStatusCode: args?.httpStatusCode,
      });
    }
    return this.permitCode;
  }

  @AfterLoad()
  setFieldValues() {
    if (!this.__has_mailHistories__) {
      this.__has_mailHistories__ = false;
    }
  }
}
