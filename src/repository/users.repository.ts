import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BanksService } from 'src/service/banks.service';
import { Bank } from 'src/domain/entity/bank.entity';
import { InviteStatus } from 'src/domain/entity/mail-history-status.entity';
import { InviteStatusEnum } from 'src/domain/enum/mail-history-status.enum';
import { MailHistory } from 'src/domain/entity/mail-history.entity';
import { MailHistoryService } from 'src/service/mail-history.service';
import { Enum } from 'src/utils/enum';
import { HttpStatusMessage } from 'src/utils/enums/http-status-message.enum';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { validateDTO } from 'src/utils/validation-utils';
import {
  Brackets,
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ILike,
  In,
  Repository,
  WhereExpressionBuilder,
} from 'typeorm';

import { Nullable } from 'src/utils/types/nullable.type';
import { RoleEnum } from 'src/security/roles/roles.enum';
import { UpdateUserRepositoryDto } from 'src/domain/dto/update-user-repository.dto';
import { User } from 'src/domain/entity/user.entity';
import { IFindUserPaginated } from 'src/domain/interface/find-user-paginated.interface';

export enum userUploadEnum {
  DUPLICATED_FIELD = 'Campo duplicado no arquivo de upload',
  FIELD_EXISTS = 'Campo existe no banco de dados',
}

@Injectable()
export class UsersRepository {
  private logger: Logger = new Logger(UsersRepository.name, {
    timestamp: true,
  });

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private mailHistoryService: MailHistoryService,
    private banksService: BanksService,
    private readonly entityManager: EntityManager,
  ) {}

  async findManyRegisteredUsers() {
    const validUsers = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.roleId = :roleId', { roleId: RoleEnum.user })
      .andWhere('user.fullName IS NOT NULL')
      .andWhere('user.cpfCnpj IS NOT NULL')
      .andWhere('user.bankCode IS NOT NULL')
      .andWhere('user.bankAgency IS NOT NULL')
      .andWhere('user.bankAccount IS NOT NULL')
      .andWhere('user.bankAccountDigit IS NOT NULL')
      .andWhere("user.fullName != ''")
      .andWhere("user.cpfCnpj != ''")
      .andWhere("user.bankAgency != ''")
      .andWhere('LENGTH(TRIM(user.bankAccount)) >= 1')
      .andWhere('LENGTH(TRIM(user.bankAccount)) <= 12')
      /* *Ignore fields like "67" etc */
      .andWhere('LENGTH(TRIM(user.bankAccountDigit)) = 1')
      .getMany();
    await this.loadLazyRelations(validUsers)
    return validUsers;
  }

  /**
   * Save or update new user in database.
   * @returns created user.
   */
  async create(createProfileDto: DeepPartial<User>): Promise<User> {
    const createdUser = await this.usersRepository.save(
      this.usersRepository.create(createProfileDto),
    );
    this.logger.log(`Usuário criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  // #region loadLazyRelations

  /**
   * Load data of lazy relations (not eager)
   */
  async loadLazyRelations(users: User[]) {
    await this.loadLazyAux_bank(users);
    await this.loadLazyAux_invite(users);
  }

  private async loadLazyAux_invite(users: User[]) {
    // Find
    const ids = users.map((i) => i.id);
    /** key: user.id */
    const mails = await this.mailHistoryService.find({
      user: { id: In(ids) },
    });

    // Set values
    for (const user of users) {
      const mailHistories = mails.filter((i) => i.user.id === user.id);
      const mailHistory = mailHistories?.[0] as MailHistory | undefined;
      user.mailHistories = mails.filter((i) => i.user.id === user.id);
      user.aux_inviteStatus = mailHistory?.inviteStatus;
      user.aux_inviteHash = mailHistory?.hash;
    }
  }

  private async loadLazyAux_bank(users: User[]) {
    // Find banks
    const bankCodes = users.reduce(
      (l, i) => (typeof i?.bankCode === 'number' ? [...l, i.bankCode] : l),
      [],
    );
    /** key: bank code */
    const bankMap: Record<number, Bank> = (
      await this.banksService.findMany({ code: In(bankCodes) })
    ).reduce((map, i) => ({ ...map, [i.code]: i }), {});

    // Set banks
    for (const user of users) {
      if (typeof user?.bankCode === 'number') {
        user.aux_bank = bankMap[user.bankCode];
      }
    }
  }

  // #endregion

  async findMany(options?: FindManyOptions<User>): Promise<User[]> {
    const users = await this.usersRepository.find(options);
    await this.loadLazyRelations(users);
    return users;
  }

  // #region findManyWithPagination

  async findManyWithPagination(
    paginationOptions: PaginationOptions,
    fields?: IFindUserPaginated,
  ): Promise<User[]> {
    let inviteStatus: any = null;
    if (fields?.inviteStatusName) {
      inviteStatus = {
        id: Number(InviteStatusEnum[fields?.inviteStatusName]),
        name: Enum.getKey(
          InviteStatusEnum,
          InviteStatusEnum[fields?.inviteStatusName],
        ),
      };
    }

    const { where, andWhere } = this.getFindUserPaginatedToWhere(fields);

    let users = await this.usersRepository
      .createQueryBuilder('user')
      .where(
        new Brackets((qb) => {
          where(qb);
        }),
      )
      .andWhere(andWhere)
      .getMany();
    users = await this.usersRepository.find({
      where: {
        id: In(users.map((i) => i.id)),
      },
    });
    await this.loadLazyRelations(users);

    let invites: Nullable<MailHistory[]> = null;
    if (inviteStatus) {
      invites = await this.mailHistoryService.find({ inviteStatus });
    }

    users = users.filter((userItem) => {
      return (
        !invites ||
        (invites.length > 0 &&
          invites.some((inviteItem) => inviteItem.user.id === userItem.id))
      );
    });

    return users;
  }

  private getFindUserPaginatedToWhere(fields?: IFindUserPaginated) {
    const isSgtuBlocked = fields?.isSgtuBlocked || fields?._anyField?.value;
    const andWhere = {
      ...(fields?.role
        ? {
            role: { id: fields.role.id },
          }
        : {}),
    } as FindOptionsWhere<User>;

    const where = (qb: WhereExpressionBuilder) => {
      const whereFields = [
        ...(fields?.permitCode || fields?._anyField?.value
          ? [
              {
                permitCode: ILike(
                  `%${fields?.permitCode || fields?._anyField?.value}%`,
                ),
              },
            ]
          : []),

        ...(fields?.email || fields?._anyField?.value
          ? [{ email: ILike(`%${fields?.email || fields?._anyField?.value}%`) }]
          : []),

        ...(fields?.cpfCnpj || fields?._anyField?.value
          ? [
              {
                cpfCnpj: ILike(
                  `%${fields?.cpfCnpj || fields?._anyField?.value}%`,
                ),
              },
            ]
          : []),

        ...(isSgtuBlocked === 'true' || isSgtuBlocked === 'false'
          ? [{ isSgtuBlocked: isSgtuBlocked === 'true' }]
          : []),

        ...(fields?.passValidatorId || fields?._anyField?.value
          ? [
              {
                passValidatorId: ILike(
                  `%${fields?.passValidatorId || fields?._anyField?.value}%`,
                ),
              },
            ]
          : []),
      ] as FindOptionsWhere<User>[];

      if (fields?.name || fields?._anyField?.value) {
        const fieldName = fields?.name || fields?._anyField?.value;
        return qb
          .where(() => (whereFields.length > 0 ? whereFields : '1 = 0'))
          .orWhere(
            'unaccent(UPPER("user"."fullName")) ILIKE unaccent(UPPER(:name))',
            { name: `%${fieldName}%` },
          )
          .orWhere(
            'unaccent(UPPER("user"."firstName")) ILIKE unaccent(UPPER(:name))',
            { name: `%${fieldName}%` },
          )
          .orWhere(
            'unaccent(UPPER("user"."lastName")) ILIKE unaccent(UPPER(:name))',
            { name: `%${fieldName}%` },
          );
      } else {
        return qb.where(whereFields);
      }
    };
    return {
      where: where,
      andWhere: andWhere,
    };
  }

  // #endregion

  async findOne(options: FindOneOptions<User>): Promise<Nullable<User>> {
    const user = await this.usersRepository.findOne(options);
    if (user) {
      await this.loadLazyRelations([user]);
    }
    return user;
  }

  /**
   * @param id Valid user ID
   * @param logContext Upper method who called this one
   * @param requestUser Who is updating this data. Used to log properly.
   * @returns Updated user
   */
  async update(
    id: number,
    dataToUpdate: DeepPartial<User>,
    logContext?: string,
    requestUser?: DeepPartial<User>,
  ): Promise<User> {
    const METHOD = `${logContext}->${this.update.name}`;
    const user = await this.getOne({ where: { id } });

    // Validate email, cpfCnpj etc before update
    await validateDTO(UpdateUserRepositoryDto, {
      id: id,
      ...dataToUpdate,
    } as UpdateUserRepositoryDto);

    if (
      dataToUpdate.bankCode &&
      user.bankCode &&
      dataToUpdate.bankCode !== user.bankCode
    ) {
      dataToUpdate.previousBankCode = user.bankCode;
    }

    // If email is different, update invite email
    if (
      dataToUpdate.email &&
      user.mailHistories.length > 0 &&
      user.email !== dataToUpdate.email
    ) {
      await this.mailHistoryService.update(
        user.mailHistories[0].id,
        {
          email: dataToUpdate.email,
        },
        METHOD,
      );
    }
    if (
      'bankAccount' in dataToUpdate ||
      'bankCode' in dataToUpdate ||
      'bankAgency' in dataToUpdate
    ) {
      dataToUpdate.updatedAt = new Date();
    }
    // Update user
    dataToUpdate.password = await user.parseNewPassword(dataToUpdate.password);
    await this.usersRepository.update(id, dataToUpdate);
    const updatedUser = await this.getOne({ where: { id: id } });
    await this.loadLazyRelations([updatedUser]);

    // Log
    const logMsg =
      `Usuário ${id} atualizou os campos de ` +
      +`${user.getLogInfo()}: [ ${Object.keys(dataToUpdate)} ]`;
    this.logger.log(logMsg, 'update()');

    return updatedUser;
  }

  /**
   * @throws `HttpException`
   */
  async getOne(options: FindOneOptions<User>): Promise<User> {
    const user = await this.findOne(options);
    if (!user) {
      throw new HttpException(
        {
          error: HttpStatusMessage.NOT_FOUND,
          details: {
            ...(!user && { user: 'userNotFound' }),
          },
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  /**
   * Get users where:
   * - status = USED who created login/password but didn't fill bank fields
   * - status = SENT who didn't create login/password
   * with no waiting for 15 days before resend
   */
  async getNotRegisteredUsers(): Promise<User[]> {
    const results: any[] = await this.entityManager.query(
      'SELECT U."fullName", u.email, u.phone, iv."name", i."sentAt", i."inviteStatusId", i."hash" ' +
        'FROM public."user" U inner join invite i on  U.id = i."userId" ' +
        'inner join invite_status iv on iv.id = i."inviteStatusId" ' +
        'where u."bankCode" is null ' +
        'and i."sentAt" <= now() - INTERVAL \'30 DAYS\' ' +
        'and "roleId" != 1 ' +
        'and i."inviteStatusId" != 2 ' +
        'order by U."fullName", i."sentAt" ',
    );
    const users: User[] = [];

    // From raw query add 'manually' fields and aux_columns
    for (const result of results) {
      users.push(
        new User({
          fullName: result.fullName,
          email: result.email,
          phone: result.phone,
          aux_inviteStatus: new InviteStatus(Number(result.inviteStatusId)),
          aux_inviteHash: result.hash,
        }),
      );
    }
    return users;
  }
}
