import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { Request } from 'express';
import { BanksService } from 'src/banks/banks.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { isArrayContainEqual } from 'src/utils/array-utils';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { formatLog } from 'src/utils/log-utils';
import { stringUppercaseUnaccent } from 'src/utils/string-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { InvalidRowsType } from 'src/utils/types/invalid-rows.type';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { DeepPartial, EntityManager } from 'typeorm';
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
import { UsersRepository } from './users.repository';

export enum userUploadEnum {
  DUPLICATED_FIELD = 'Campo duplicado no arquivo de upload',
  FIELD_EXISTS = 'Campo existe no banco de dados',
}

@Injectable()
export class UsersService {
  private logger: Logger = new Logger('UsersService', { timestamp: true });

  constructor(
    @InjectRepository(User)
    private usersRepository: UsersRepository,
    private mailHistoryService: MailHistoryService,
    private banksService: BanksService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(createProfileDto: CreateUserDto): Promise<User> {
    const createdUser = await this.usersRepository.create(createProfileDto);
    this.logger.log(`Usuário criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async findMany(
    fields: EntityCondition<User> | EntityCondition<User>[],
  ): Promise<User[]> {
    return await this.usersRepository.findMany({ where: fields });
  }

  async findManyWithPagination(
    paginationOptions: IPaginationOptions,
    fields?: IFindUserPaginated,
  ): Promise<User[]> {
    return await this.usersRepository.findManyWithPagination(
      paginationOptions,
      fields,
    );
  }

  async findOne(
    fields: EntityCondition<User> | EntityCondition<User>[],
  ): Promise<NullableType<User>> {
    return this.usersRepository.findOne({ where: fields });
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
    return this.usersRepository.update(
      id,
      dataToUpdate,
      logContext,
      requestUser,
    );
  }

  /**
   * @throws `HttpException`
   */
  async getOne(fields: EntityCondition<User>): Promise<User> {
    return await this.usersRepository.getOne({ where: fields });
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
        fullName: stringUppercaseUnaccent(fileUser.user.nome as string),
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

  /**
   * Get users with status = SENT who didn't create login/password
   */
  async getUnregisteredUsers(): Promise<User[]> {
    const results: any[] = await this.entityManager.query(
      'SELECT u."fullName", u."email", u."phone", i."sentAt", i."inviteStatusId", i."hash" ' +
        'FROM public."user" u ' +
        'INNER JOIN invite i ON u.id = i."userId" ' +
        `WHERE i."inviteStatusId" = ${InviteStatusEnum.sent} ` +
        'AND i."sentAt" <= NOW() - INTERVAL \'15 DAYS\' ' +
        `AND u."roleId" = ${RoleEnum.user} ` +
        'ORDER BY U."fullName", i."sentAt"',
    );
    const users: User[] = [];
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
