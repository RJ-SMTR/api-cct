import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BanksService } from 'src/banks/banks.service';
import { Bank } from 'src/banks/entities/bank.entity';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { Enum } from 'src/utils/enum';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { formatLog } from 'src/utils/log-utils';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import {
  Brackets,
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ILike,
  Repository,
  WhereExpressionBuilder,
} from 'typeorm';
import { NullableType } from '../utils/types/nullable.type';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { IFindUserPaginated } from './interfaces/find-user-paginated.interface';

export enum userUploadEnum {
  DUPLICATED_FIELD = 'Campo duplicado no arquivo de upload',
  FIELD_EXISTS = 'Campo existe no banco de dados',
}

@Injectable()
export class UsersRepository {
  private logger: Logger = new Logger('UsersService', { timestamp: true });

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private mailHistoryService: MailHistoryService,
    private banksService: BanksService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(createProfileDto: CreateUserDto): Promise<User> {
    const createdUser = await this.usersRepository.save(
      this.usersRepository.create(createProfileDto),
    );
    this.logger.log(`Usuário criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async setUserAuxColumns(user: User) {
    user.aux_bank = await this.getAux_bank(user);
  }

  async findMany(options?: FindManyOptions<User>): Promise<User[]> {
    const users = await this.usersRepository.find(options);
    for (const user of users) {
      await this.setUserAuxColumns(user);
    }
    return users;
  }

  // #region findManyWithPagination

  async findManyWithPagination(
    paginationOptions: IPaginationOptions,
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

    let invites: NullableType<MailHistory[]> = null;
    if (inviteStatus) {
      invites = await this.mailHistoryService.find({ inviteStatus });
    }

    for (const user of users) {
      await this.setUserAuxColumns(user);
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

  private async getAux_bank(user: User): Promise<Bank | null> {
    if (user?.bankCode === undefined || user?.bankCode === null) {
      return null;
    }
    return await this.banksService.findOne({ code: user?.bankCode });
  }

  async findOne(options: FindOneOptions<User>): Promise<NullableType<User>> {
    const user = await this.usersRepository.findOne(options);
    if (user) {
      await this.setUserAuxColumns(user);
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
    const oldUser = await this.getOne({ id });
    const history = await this.mailHistoryService.getOne({
      user: { id: oldUser.id },
    });

    // Validate
    if (dataToUpdate.email !== null && dataToUpdate.email !== undefined) {
      const userBD = await this.findOne({ email: dataToUpdate.email });
      if (userBD !== null && userBD.id != oldUser.id) {
        throw new HttpException(
          {
            error: 'user email already exists',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      } else if (oldUser.email !== dataToUpdate.email) {
        history.setInviteStatus(InviteStatusEnum.queued);
        history.email = dataToUpdate.email;
        history.hash = await this.mailHistoryService.generateHash();
        await this.mailHistoryService.update(
          history.id,
          history,
          'UsersService.update()',
        );
      }
    }

    // Update
    await this.usersRepository.update(id, dataToUpdate);
    const updatedUser: User = await this.findOne({ id: id })[0];
    await this.setUserAuxColumns(updatedUser);

    // Log
    const reqUser = new User(requestUser);
    const logMsg =
      `Usuário ${reqUser.getLogInfo()} atualizou os campos de ` +
      +`${oldUser.getLogInfo()}: [ ${Object.keys(dataToUpdate)} ]`;
    this.logger.log(formatLog(logMsg, 'update()', 'logContext'));

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
          error: HttpErrorMessages.NOT_FOUND,
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
