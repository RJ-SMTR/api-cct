import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { Request } from 'express';
import { BanksService } from 'src/banks/banks.service';
import { Bank } from 'src/banks/entities/bank.entity';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { isArrayContainEqual } from 'src/utils/array-utils';
import { Enum } from 'src/utils/enum';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { formatLog } from 'src/utils/logging';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { InvalidRowsType } from 'src/utils/types/invalid-rows.type';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import {
  Brackets,
  DeepPartial,
  FindOptionsWhere,
  ILike,
  Repository,
  WhereExpressionBuilder,
} from 'typeorm';
import * as xlsx from 'xlsx';
import { NullableType } from '../utils/types/nullable.type';
import { CreateUserFileDto } from './dto/create-user-file.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { ICreateUserFile } from './interfaces/create-user-file.interface';
import { IFileUser } from './interfaces/file-user.interface';
import { IFindUserPaginated } from './interfaces/find-user-paginated.interface';
import { IUserUploadResponse } from './interfaces/user-upload-response.interface';
import { FileUserMap } from './mappings/user-file.map';

export enum userUploadEnum {
  DUPLICATED_FIELD = 'Campo duplicado no arquivo de upload',
  FIELD_EXISTS = 'Campo existe no banco de dados',
}

@Injectable()
export class UsersService {
  private logger: Logger = new Logger('UsersService', { timestamp: true });

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private mailHistoryService: MailHistoryService,
    private banksService: BanksService,
  ) {}

  async create(createProfileDto: CreateUserDto): Promise<User> {
    const createdUser = await this.usersRepository.save(
      this.usersRepository.create(createProfileDto),
    );
    this.logger.log(`Usuário criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async setUserAuxColumns(user: User): Promise<User> {
    const newUser = new User(user);
    newUser.aux_bank = await this.getAux_bank(user);
    newUser.aux_inviteStatus = await this.getAux_inviteSatus(user);
    return newUser;
  }

  async findMany(
    fields: EntityCondition<User> | EntityCondition<User>[],
  ): Promise<User[]> {
    const users = await this.usersRepository.find({
      where: fields,
    });
    for (const i in users) {
      users[i] = await this.setUserAuxColumns(users[i]);
    }
    return users;
  }

  async findManyWithPagination(
    paginationOptions: IPaginationOptions,
    fields?: IFindUserPaginated,
  ): Promise<User[]> {
    console.log('findManyWithPagination');
    const isSgtuBlocked = fields?.isSgtuBlocked || fields?._anyField?.value;

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
            'unaccent(LOWER("user"."fullName")) ILIKE unaccent(LOWER(:name))',
            { name: `%${fieldName}%` },
          )
          .orWhere(
            'unaccent(LOWER("user"."firstName")) ILIKE unaccent(LOWER(:name))',
            { name: `%${fieldName}%` },
          )
          .orWhere(
            'unaccent(LOWER("user"."lastName")) ILIKE unaccent(LOWER(:name))',
            { name: `%${fieldName}%` },
          );
      } else {
        return qb.where(whereFields);
      }
    };

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

    for (const i in users) {
      users[i] = await this.setUserAuxColumns(users[i]);
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

  private async getAux_inviteSatus(user: User): Promise<InviteStatus | null> {
    const invite = await this.mailHistoryService.findRecentByUser(user);
    let inviteStatus: InviteStatus | null = null;
    if (invite?.inviteStatus !== undefined) {
      inviteStatus = invite.inviteStatus;
    }
    return inviteStatus;
  }

  private async getAux_bank(user: User): Promise<Bank | null> {
    if (user?.bankCode === undefined || user?.bankCode === null) {
      return null;
    }
    return await this.banksService.findOne({ code: user?.bankCode });
  }

  async findOne(
    fields: EntityCondition<User> | EntityCondition<User>[],
  ): Promise<NullableType<User>> {
    let user = await this.usersRepository.findOne({
      where: fields,
    });
    if (user !== null) {
      user = await this.setUserAuxColumns(user);
    }
    return user;
  }

  async update(
    id: number,
    payload: DeepPartial<User>,
    logContext?: string,
    logUser?: DeepPartial<User>,
  ): Promise<User> {
    const oldUser = await this.getOne({ id });
    const history = await this.mailHistoryService.getOne({
      user: { id: oldUser.id },
    });
    const newUser = new User(oldUser);

    if (payload.email !== null && payload.email !== undefined) {
      const userBD = await this.findOne({ email: payload.email });
      if (userBD !== null && userBD.id != oldUser.id) {
        throw new HttpException(
          {
            error: 'user email already exists',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      } else if (oldUser.email !== payload.email) {
        history.setInviteStatus(InviteStatusEnum.queued);
        history.email = payload.email;
        history.hash = await this.mailHistoryService.generateHash();
        await this.mailHistoryService.update(
          history.id,
          history,
          'UsersService.update()',
        );
      }
    }

    newUser.update(payload);
    let createPayload = await this.usersRepository.save(
      this.usersRepository.create(newUser),
    );
    createPayload = await this.setUserAuxColumns(createPayload);

    // Log
    const reqUser = new User(logUser);
    let logMsg = `Usuário ${oldUser.getLogInfo()} teve seus campos atualizados: [ ${Object.keys(
      payload,
    )} ]`;
    if (reqUser.id === oldUser.id) {
      logMsg = `Usuário ${oldUser.getLogInfo()} atualizou seus campos: [ ${Object.keys(
        payload,
      )} ]`;
    }
    if (reqUser.getLogInfo() !== '[VAZIO]') {
      logMsg =
        `Usuário ${reqUser.getLogInfo()}` +
        ` atualizou os campos de ${oldUser.getLogInfo()}: [${Object.keys(
          payload,
        )}]`;
    }
    this.logger.log(formatLog(logMsg, 'update()', logContext));

    return createPayload;
  }

  async softDelete(id: number, logContext?: string): Promise<void> {
    await this.usersRepository.softDelete(id);
    this.logger.log(
      formatLog(
        `Usuário ${{ id }} desativado com sucesso.`,
        'softDelete()',
        logContext,
      ),
    );
  }

  /**
   * @throws `HttpException`
   */
  async getOne(fields: EntityCondition<User>): Promise<User> {
    let user = await this.findOne(fields);
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
    user = await this.setUserAuxColumns(user);
    return user;
  }

  async getOneFromRequest(request: Request): Promise<User> {
    const userId = request?.user?.['id'];
    if (!userId) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            ...(!request.user && { loggedUser: 'loggedUserNotExists' }),
            ...(!userId && { loggedUser: 'loggedUserIdNotExists' }),
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return await this.getOne({
      id: userId,
    });
  }

  getWorksheetFromFile(file: Express.Multer.File): xlsx.WorkSheet {
    if (!file) {
      throw new HttpException(
        {
          errors: {
            file: 'selectFile',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    let worksheet: xlsx.WorkSheet | undefined = undefined;

    try {
      const workbook = xlsx.read(file.buffer, {
        type: 'buffer',
        codepage: 65001 /* UTF8 */,
      });
      const sheetName = workbook.SheetNames[0];
      worksheet = workbook.Sheets[sheetName];
    } catch (error) {
      throw new HttpException(
        `Error parsing file`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return worksheet;
  }

  private validateFileHeaders(worksheet: xlsx.WorkSheet) {
    const expectedFileUserFields: string[] = Object.values(FileUserMap);
    const receivedHeaders: any[] = [];
    for (const key in worksheet) {
      if (worksheet.hasOwnProperty(key)) {
        if (key.endsWith('1') && key.length === 2) {
          receivedHeaders.push(worksheet[key].v);
        }
      }
    }
    if (!isArrayContainEqual(expectedFileUserFields, receivedHeaders)) {
      throw new HttpException(
        {
          error: {
            file: {
              message: 'inivalidHeaders',
              receivedHeaders: receivedHeaders,
              expectedHeaders: expectedFileUserFields,
            },
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  async validateFileValues(
    userFile: IFileUser,
    fileUsers: IFileUser[],
    validatorDto,
  ): Promise<InvalidRowsType> {
    const schema = plainToClass(validatorDto, userFile.user);
    const errors = await validate(schema as Record<string, any>, {
      stopAtFirstError: true,
    });
    const SEPARATOR = '; ';
    const errorDictionary: InvalidRowsType = errors.reduce((result, error) => {
      const { property, constraints } = error;
      if (property && constraints) {
        result[property] = Object.values(constraints).join(SEPARATOR);
      }
      return result;
    }, {});
    const fields = ['email', 'permitCode', 'cpfCnpj'];

    // If has another user in DB with same email OR permitCode OR cpfCnpj
    if (
      userFile.user.email ||
      userFile.user.codigo_permissionario ||
      userFile.user.cpf
    ) {
      const dbFoundUsers = await this.findMany([
        ...(userFile.user.email ? [{ email: userFile.user.email }] : []),
        ...(userFile.user.codigo_permissionario
          ? [{ permitCode: userFile.user.codigo_permissionario }]
          : []),
        ...(userFile.user.cpf ? [{ cpfCnpj: userFile.user.cpf }] : []),
      ]);
      if (dbFoundUsers.length > 0) {
        for (const dbField of fields) {
          const dtoField = FileUserMap[dbField];
          if (
            dbFoundUsers.find((i) => i[dbField] === userFile.user[dtoField])
          ) {
            if (!errorDictionary.hasOwnProperty(dtoField)) {
              errorDictionary[dtoField] = '';
            }
            if (errorDictionary[dtoField].length > 0) {
              errorDictionary[dtoField] += SEPARATOR;
            }
            errorDictionary[dtoField] += userUploadEnum.FIELD_EXISTS;
          }
        }
      }
    }

    // If has another user in upload with same email OR permitCode OR cpfCnpj
    const existingFileUser = fileUsers.filter(
      (i) =>
        i.user.email === userFile.user.email ||
        i.user.codigo_permissionario === userFile.user.codigo_permissionario ||
        i.user.cpf === userFile.user.cpf,
    );
    if (existingFileUser.length > 1) {
      for (const dbField of fields) {
        const dtoField = FileUserMap[dbField];
        const existingFUserByField = existingFileUser.filter(
          (i) => i.user[dbField] === userFile.user[dbField],
        );
        if (existingFUserByField.length > 1) {
          if (!errorDictionary.hasOwnProperty(dtoField)) {
            errorDictionary[dtoField] = '';
          }
          if (errorDictionary[dtoField].length > 0) {
            errorDictionary[dtoField] += SEPARATOR;
          }
          errorDictionary[dtoField] += userUploadEnum.DUPLICATED_FIELD;
        }
      }
    }

    return errorDictionary;
  }

  async getUserFilesFromWorksheet(
    worksheet: xlsx.WorkSheet,
    validatorDto,
  ): Promise<IFileUser[]> {
    this.validateFileHeaders(worksheet);

    const fileData = xlsx.utils.sheet_to_json(worksheet);
    const fileUsers: IFileUser[] = fileData.map(
      (item: Partial<ICreateUserFile>) => ({
        user: item,
        errors: {},
      }),
    );
    let row = 2;
    for (let i = 0; i < fileUsers.length; i++) {
      const fileUser = fileUsers[i];
      const errorDictionary = await this.validateFileValues(
        fileUser,
        fileUsers,
        validatorDto,
      );
      fileUsers[i] = {
        row: row,
        ...fileUser,
        errors: errorDictionary,
      };
      row++;
    }
    return fileUsers;
  }

  async createFromFile(
    file: Express.Multer.File,
    requestUser?: DeepPartial<User>,
  ): Promise<IUserUploadResponse> {
    const reqUser = new User(requestUser);
    const worksheet = this.getWorksheetFromFile(file);
    const fileUsers = await this.getUserFilesFromWorksheet(
      worksheet,
      CreateUserFileDto,
    );
    const invalidUsers = fileUsers.filter(
      (i) => Object.keys(i.errors).length > 0,
    );
    const validUsers = fileUsers.filter(
      (i) => Object.keys(i.errors).length === 0,
    );

    if (invalidUsers.length > 0) {
      throw new HttpException(
        {
          error: {
            requestUser: reqUser.getLogInfo(),
            file: {
              message: 'invalidRows',
              headerMap: FileUserMap,
              uploadedUsers: validUsers.length,
              invalidUsers: invalidUsers.length,
              invalidRows: invalidUsers,
            },
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    for (const fileUser of validUsers) {
      const hash = await this.mailHistoryService.generateHash();
      const createdUser = this.usersRepository.create({
        permitCode: String(fileUser.user.codigo_permissionario).replace(
          "'",
          '',
        ),
        email: fileUser.user.email,
        phone: fileUser.user.telefone,
        fullName: fileUser.user.nome,
        cpfCnpj: fileUser.user.cpf,
        hash: hash,
        status: new Status(StatusEnum.register),
        role: new Role(RoleEnum.user),
      } as DeepPartial<User>);
      await this.usersRepository.save(createdUser);
      this.logger.log(
        formatLog(
          `Usuario: ${createdUser.getLogInfo()} criado.`,
          'createFromFile()',
        ),
      );

      await this.mailHistoryService.create(
        {
          user: createdUser,
          hash: hash,
          email: createdUser.email as string,
          inviteStatus: {
            id: InviteStatusEnum.queued,
          },
        },
        'UsersService.createFromFile()',
      );
    }

    const uploadedRows = validUsers.reduce(
      (part: DeepPartial<IFileUser>[], i) => [
        ...part,
        {
          row: i.row,
          user: { codigo_permissionario: i.user.codigo_permissionario },
        },
      ],
      [],
    );

    const result: IUserUploadResponse = {
      headerMap: FileUserMap,
      uploadedUsers: validUsers.length,
      invalidUsers: invalidUsers.length,
      invalidRows: invalidUsers,
      uploadedRows: uploadedRows,
    };
    this.logger.log(
      formatLog(
        'Tarefa finalizada, resultado:\n' +
          JSON.stringify({
            requestUser: reqUser.getLogInfo(),
            ...result,
          }),
        'createFromFile()',
      ),
    );
    return result;
  }
}
