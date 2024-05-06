import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { Request } from 'express';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { isArrayContainEqual } from 'src/utils/array-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { HttpStatusMessage } from 'src/utils/enums/http-error-message.enum';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { InvalidRows } from 'src/utils/types/invalid-rows.type';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { DeepPartial, FindManyOptions } from 'typeorm';
import * as xlsx from 'xlsx';
import { CreateUserFileDto } from './dto/create-user-file.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { ICreateUserFile } from './interfaces/create-user-file.interface';
import { IFileUser } from './interfaces/file-user.interface';
import { IFindUserPaginated } from './interfaces/find-user-paginated.interface';
import { IUserUploadResponse } from './interfaces/user-upload-response.interface';
import { FileUserMap } from './mappings/user-file.map';
import { UsersRepository } from './users.repository';
import { Nullable } from 'src/utils/types/nullable.type';
import { getStringUpperUnaccent } from 'src/utils/string-utils';

export enum userUploadEnum {
  DUPLICATED_FIELD = 'Campo duplicado no arquivo de upload',
  FIELD_EXISTS = 'Campo existe no banco de dados',
}

@Injectable()
export class UsersService {
  private logger: CustomLogger = new CustomLogger(UsersService.name, {
    timestamp: true,
  });

  constructor(
    private usersRepository: UsersRepository,
    private mailHistoryService: MailHistoryService,
  ) {}

  async create(createProfileDto: CreateUserDto): Promise<User> {
    const createdUser = await this.usersRepository.create(createProfileDto);
    this.logger.log(`Usuário criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async findMany(options: FindManyOptions<User>): Promise<User[]> {
    return await this.usersRepository.findMany(options);
  }

  async findManyRegisteredUsers() {
    return await this.usersRepository.findManyRegisteredUsers();
  }

  async findManyWithPagination(
    paginationOptions: PaginationOptions,
    fields?: IFindUserPaginated,
  ): Promise<User[]> {
    return await this.usersRepository.findManyWithPagination(
      paginationOptions,
      fields,
    );
  }

  async findOne(fields: EntityCondition<User>): Promise<Nullable<User>> {
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
          error: HttpStatusMessage.UNAUTHORIZED,
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

  // #region createFromFile

  async createFromFile(
    file: Express.Multer.File,
    requestUser?: DeepPartial<User>,
  ): Promise<IUserUploadResponse> {
    const reqUser = new User(requestUser);
    const worksheet = this.getWorksheetFromFile(file);
    const fileUsers = await this.getUserFilesFromWorksheet(worksheet);
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
      const createdUser = await this.usersRepository.create({
        permitCode: String(fileUser.user.codigo_permissionario).replace(
          "'",
          '',
        ),
        email: fileUser.user.email,
        phone: fileUser.user.telefone,
        fullName: getStringUpperUnaccent(fileUser.user.nome as string),
        cpfCnpj: fileUser.user.cpf,
        hash: hash,
        status: new Status(StatusEnum.register),
        role: new Role(RoleEnum.user),
      } as DeepPartial<User>);
      this.logger.log(
        `Usuario: ${createdUser.getLogInfo()} criado.`,
        'createFromFile()',
      );

      await this.mailHistoryService.create(
        {
          user: { id: createdUser.id },
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
      'Tarefa finalizada, resultado:\n' +
        JSON.stringify({
          requestUser: reqUser.getLogInfo(),
          ...result,
        }),
      'createFromFile()',
    );
    return result;
  }

  private getWorksheetFromFile(file: Express.Multer.File): xlsx.WorkSheet {
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

  async getUserFilesFromWorksheet(
    worksheet: xlsx.WorkSheet,
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
  ): Promise<InvalidRows> {
    const schema = plainToClass(CreateUserFileDto, userFile.user);
    const errors = await validate(schema as Record<string, any>, {
      stopAtFirstError: false,
    });
    const SEPARATOR = '; ';
    const errorDictionary: InvalidRows = errors.reduce((result, error) => {
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
      const dbFoundUsers = await this.findMany({
        where: [
          ...(userFile.user.email ? [{ email: userFile.user.email }] : []),
          ...(userFile.user.codigo_permissionario
            ? [{ permitCode: userFile.user.codigo_permissionario }]
            : []),
          ...(userFile.user.cpf ? [{ cpfCnpj: userFile.user.cpf }] : []),
        ],
      });
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

  // #endregion

  /**
   * Get users where:
   * - status = USED who created login/password but didn't fill bank fields
   * - status = SENT who didn't create login/password
   * with no waiting for 15 days before resend
   */
  async getNotRegisteredUsers(): Promise<User[]> {
    return await this.usersRepository.getNotRegisteredUsers();
  }
}
