import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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
import { HttpStatusMessage } from 'src/utils/enums/http-status-message.enum';
import { asString } from 'src/utils/pipe-utils';
import { getStringUpperUnaccent } from 'src/utils/string-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { InvalidRows } from 'src/utils/types/invalid-rows.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import {
  Brackets,
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOptionsWhere,
  ILike,
  In,
  WhereExpressionBuilder,
} from 'typeorm';
import * as xlsx from 'xlsx';
import { CreateUserFileDto } from './dto/create-user-file.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserFileDto } from './dto/update-user-file.dto copy';
import { User } from './entities/user.entity';
import { ICreateUserFile } from './interfaces/create-user-file.interface';
import { IFileUser } from './interfaces/file-user.interface';
import { IFindUserPaginated } from './interfaces/find-user-paginated.interface';
import { IUserUploadResponse } from './interfaces/user-upload-response.interface';
import { FileUserMap, ReverseFileUserMap } from './mappings/user-file.map';
import { UserUploadData } from './types/user-upload-data.type';
import { UsersRepository } from './users.repository';

export enum userUploadEnum {
  DUPLICATED_FIELD = 'Campo duplicado no arquivo de upload',
  FIELD_EXISTS = 'Campo existe no banco de dados',
  FIELD_NOT_EXISTS = 'Campo a ser atualizado não existe no banco',
}

@Injectable()
export class UsersService {
  private logger: Logger = new Logger('UsersService', { timestamp: true });

  constructor(
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

  async setUserAuxColumns(user: User): Promise<User> {
    const newUser = new User(user);
    await this.setManyAux_bank([newUser]);
    newUser.aux_inviteStatus = await this.getAux_inviteSatus(user);
    return newUser;
  }

  async setManyUserAuxColumns(users: User[]) {
    await this.setManyAux_bank(users);
    await this.setManyAux_invite(users);
  }

  async count(options: FindManyOptions<User>): Promise<number> {
    return await this.usersRepository.count(options);
  }

  async findMany(
    options: FindManyOptions<User>,
    loadAuxColumns = true,
  ): Promise<User[]> {
    const users = (await this.usersRepository.findMany(options)) || [];
    if (loadAuxColumns) {
      await this.setManyUserAuxColumns(users);
    }
    return users;
  }

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
      .andWhere("user.bankAccount != ''")
      .andWhere("user.bankAccountDigit != ''")
      .getMany();
    await this.setManyUserAuxColumns(validUsers);
    return validUsers;
  }

  async findManyWithPagination(
    paginationOptions: IPaginationOptions,
    fields?: IFindUserPaginated,
  ): Promise<User[]> {
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
      invites = await this.mailHistoryService.findMany({ inviteStatus });
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

  private async setManyAux_invite(users: User[]) {
    // Find banks
    const invitesMap: Record<string, MailHistory> = (
      await this.mailHistoryService.findManyRecentByUser(users)
    ).reduce((map, i) => ({ ...map, [i.user.id]: i }), {});

    // Update
    for (const user of users) {
      const invite: MailHistory | undefined = invitesMap?.[user.id];
      if (invite) {
        user.aux_inviteHash = invite.hash;
        user.aux_inviteStatus = invite.inviteStatus;
      }
    }
  }

  private async setManyAux_bank(users: User[]) {
    // Find banks
    const bankCodes = users.reduce(
      (l, i) => (typeof i.bankCode === 'number' ? [...l, i.bankCode] : l),
      [],
    );
    /** key: bank code */
    const bankMap: Record<number, Bank> = (
      await this.banksService.findMany({ code: In(bankCodes) })
    ).reduce((map, i) => ({ ...map, [i.code]: i }), {});

    // Set banks
    for (const user of users) {
      if (typeof user.bankCode === 'number') {
        user.aux_bank = bankMap[user.bankCode];
      }
    }
  }

  async findOne(fields: EntityCondition<User>): Promise<NullableType<User>> {
    let user = await this.usersRepository.findOne({
      where: fields,
    });
    if (user !== null) {
      user = await this.setUserAuxColumns(user);
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
    updateData: DeepPartial<User>,
    logContext?: string,
    requestUser?: DeepPartial<User>,
  ): Promise<User> {
    const METHOD = this.update.name;
    const CLASS_METHOD = `${UsersService.name}.${this.update.name}`;
    const oldUser = await this.getOne({ id });
    const history = await this.mailHistoryService.getOne({
      user: { id: oldUser.id },
    });

    if (updateData.email !== null && updateData.email !== undefined) {
      const userBD = await this.findOne({ email: updateData.email });
      if (userBD !== null && userBD.id != oldUser.id) {
        throw new HttpException(
          {
            error: 'user email already exists',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      } else if (oldUser.email !== updateData.email) {
        history.setInviteStatus(InviteStatusEnum.queued);
        history.email = updateData.email;
        history.hash = await this.mailHistoryService.generateHash();
        await this.mailHistoryService.update(history.id, history, CLASS_METHOD);
      }
    }

    await this.usersRepository.update(id, updateData);
    const updatedUser = await this.getOne({ id: id });

    // Log
    const reqUser = new User(requestUser);
    let logMsg = `Usuário ${oldUser.getLogInfo()} teve seus campos atualizados: [ ${Object.keys(
      updateData,
    )} ]`;
    if (reqUser.id === oldUser.id) {
      logMsg = `Usuário ${oldUser.getLogInfo()} atualizou seus campos: [ ${Object.keys(
        updateData,
      )} ]`;
    }
    if (reqUser.getLogInfo() !== '[VAZIO]') {
      logMsg =
        `Usuário ${reqUser.getLogInfo()}` +
        ` atualizou os campos de ${oldUser.getLogInfo()}: [${Object.keys(
          updateData,
        )}]`;
    }
    this.logger.log(logMsg, `${METHOD} from ${logContext}`);

    return updatedUser;
  }

  async softDelete(id: number, logContext?: string): Promise<void> {
    const METHOD = this.softDelete.name;
    await this.usersRepository.softDelete(id);
    this.logger.log(
      `Usuário ${{ id }} desativado com sucesso.`,
      `${METHOD} from ${logContext}`,
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

  // #region updateFromFiles

  public async updateFromFiles(
    files: Express.Multer.File[],
    fieldsToUpdate: (keyof ICreateUserFile)[],
    requestUser?: DeepPartial<User>,
  ): Promise<IUserUploadResponse> {
    const userFieldsToUpdate = fieldsToUpdate.map((i) => ReverseFileUserMap[i]);
    // Validate if there is file
    if (files.length === 0) {
      throw new HttpException(
        {
          error: {
            requestUser: (requestUser as User).getLogInfo(),
            file: {
              message: 'No files to update',
              headerMap: FileUserMap,
              uploadedUsers: 0,
              invalidUsers: 0,
              invalidRows: 0,
            },
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Get Users from Excels
    const uploadDatas: UserUploadData[] = [];
    for (const i in files) {
      const file = files[i];
      const worksheet = this.getWorksheetFromFile(file);
      const userFiles = this.getUserFilesFromWorksheet(worksheet, true);
      await this.validateUpdateFileValues(userFiles);
      uploadDatas.push(
        await this.getDTOsFromFile(userFiles, requestUser, Number(i) + 1),
      );
    }
    const uploadData = uploadDatas.slice(1).reduce(
      (d, i) => ({
        ...d,
        invalidRows: [...d.invalidRows, ...i.invalidRows],
        invalidUsers: d.invalidUsers + i.invalidUsers,
        uploadedRows: [...d.uploadedRows, ...i.uploadedRows],
        uploadedUsers: d.uploadedUsers + i.uploadedUsers,
        userDTOs: [...d.userDTOs, ...i.userDTOs],
      }),
      uploadDatas[0],
    );
    const dtos = uploadData.userDTOs;

    // Create or update users
    const createDTOs: DeepPartial<User>[] = [];
    const updateDTOs: DeepPartial<User>[] = [];
    const existings = await this.usersRepository.findMany({
      where: { permitCode: In(dtos.map((i) => i.permitCode)) },
    });
    const existingMap: Record<string, User> = existings.reduce(
      (m, i) => ({ ...m, [asString(i.permitCode)]: i }),
      {},
    );
    for (const i in dtos) {
      const dto = dtos[i];
      // Update user
      const existing = existingMap[asString(dto.permitCode)];
      if (existing) {
        const item: DeepPartial<User> = {};
        for (const field of userFieldsToUpdate) {
          item[field] = dto[field];
        }
        item.id = existing.id;
        updateDTOs.push(item);
      }
      // Create User
      else {
        createDTOs.push(dto);
      }
    }

    // if (uploadData.invalidRows.length > 0) {
    //   throw new HttpException(
    //     {
    //       error: {
    //         requestUser: uploadData.requestUserEntity.getLogInfo(),
    //         file: {
    //           message: 'invalidRows',
    //           headerMap: FileUserMap,
    //           updateFields: fieldsToUpdate,
    //           uploadedUsers: 0,
    //           invalidUsers: uploadData.invalidRows.length,
    //           invalidRows: uploadData.invalidRows,
    //         },
    //       },
    //     },
    //     HttpStatus.UNPROCESSABLE_ENTITY,
    //   );
    // }

    this.logger.log(
      `De ${uploadData.userDTOs.length} usuários,` +
        ` atualizando ${updateDTOs.length} válidos. ` +
        ` ${updateDTOs.length} inválidos. ` +
        ` e ignorando ${createDTOs.length} novos usuários.`,
    );

    // Create
    // if (createDTOs.length > 0) {
    //   await this.usersRepository.upsert(createDTOs, {
    //     conflictPaths: { id: true },
    //   });
    // }

    // Update
    if (updateDTOs.length > 0) {
      for (const dto of updateDTOs) {
        await this.usersRepository.update(dto.id as number, dto);
      }
      // await this.updateMany(updateDTOs, userFieldsToUpdate);
    }
    const updated = await this.usersRepository.findMany({
      where: { permitCode: In(dtos.map((i) => i.permitCode)) },
    });
    const updateLog: any[] = [];
    for (const dto of updateDTOs) {
      const existingUser = existings.find((i) => i.id === dto.id);
      const updatedUser = updated.find((i) => i.id === dto.id);
      // console.log(existingUser, updatedUser);
      updateLog.push({
        email: updatedUser?.fullName,
        cpfCnpj: `${existingUser?.cpfCnpj} -> ${updatedUser?.cpfCnpj}`,
      });
    }

    const result: IUserUploadResponse = {
      headerMap: uploadData.headerMap,
      uploadedUsers: updateDTOs.length,
      invalidUsers: uploadData.invalidUsers,
      invalidRows: uploadData.invalidRows,
      uploadedRows: uploadData.uploadedRows,
      changesLog: updateLog,
    };
    this.logger.log(
      'Tarefa finalizada, resultado:\n' +
        JSON.stringify({
          requestUser: uploadData.requestUserEntity.getLogInfo(),
          ...result,
        }),
      'createFromFile()',
    );
    return result;
  }

  // #endregion

  async updateMany(items: DeepPartial<User>[], fields: string[]) {
    return await this.usersRepository
      .createQueryBuilder()
      .insert()
      .into(User, ['id', ...fields])
      .values(items)
      .orUpdate(fields, ['id'])
      .execute();
  }

  // #region createFromFile

  async createFromFile(
    file: Express.Multer.File,
    requestUser?: DeepPartial<User>,
  ): Promise<IUserUploadResponse> {
    const worksheet = this.getWorksheetFromFile(file);
    const userFiles = this.getUserFilesFromWorksheet(worksheet);
    await this.validateCreateFileValues(userFiles);
    const uploadData = await this.getDTOsFromFile(userFiles, requestUser);

    await this.usersRepository.insert(uploadData.userDTOs);

    const result: IUserUploadResponse = {
      headerMap: uploadData.headerMap,
      uploadedUsers: uploadData.uploadedUsers,
      invalidUsers: uploadData.invalidUsers,
      invalidRows: uploadData.invalidRows,
      uploadedRows: uploadData.uploadedRows,
    };
    this.logger.log(
      'Tarefa finalizada, resultado:\n' +
        JSON.stringify({
          requestUser: uploadData.requestUserEntity.getLogInfo(),
          ...result,
        }),
      'createFromFile()',
    );
    return result;
  }

  private async getDTOsFromFile(
    fileUsers: IFileUser[],
    requestUser?: DeepPartial<User>,
    logFileIndex = 0,
  ): Promise<UserUploadData> {
    const reqUser = new User(requestUser);
    if (logFileIndex > 0) {
      fileUsers.forEach((i) => (i.file = logFileIndex));
    }
    const invalidUsers = fileUsers.filter(
      (i) => Object.keys(i.errors).length > 0,
    );
    const validUsers = fileUsers.filter(
      (i) => Object.keys(i.errors).length === 0,
    );

    // if (invalidUsers.length > 0) {
    //   throw new HttpException(
    //     {
    //       error: {
    //         requestUser: reqUser.id,
    //         file: {
    //           message: 'invalidRows',
    //           headerMap: FileUserMap,
    //           uploadedUsers: validUsers.length,
    //           invalidUsers: invalidUsers.length,
    //           invalidRows: invalidUsers,
    //         },
    //       },
    //     },
    //     HttpStatus.UNPROCESSABLE_ENTITY,
    //   );
    // }

    const userDTOs: DeepPartial<User>[] = [];
    for (const fileUser of [...validUsers, ...invalidUsers]) {
      const hash = await this.mailHistoryService.generateHash();
      userDTOs.push({
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
        mailHistories: [
          {
            hash: hash,
            email: fileUser.user.email,
            inviteStatus: {
              id: InviteStatusEnum.queued,
            },
          },
        ],
      });
    }
    const uploadedRows = validUsers.reduce(
      (part: DeepPartial<IFileUser>[], i) => [
        ...part,
        {
          ...(logFileIndex > 0 ? { file: logFileIndex } : {}),
          row: i.row,
          user: i.user,
        },
      ],
      [],
    );

    return {
      headerMap: FileUserMap,
      uploadedUsers: validUsers.length,
      invalidUsers: invalidUsers.length,
      invalidRows: invalidUsers,
      uploadedRows: uploadedRows,
      userDTOs: userDTOs,
      requestUserEntity: reqUser,
    };
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

  getUserFilesFromWorksheet(
    worksheet: xlsx.WorkSheet,
    fixCpfZeroes = false,
  ): IFileUser[] {
    this.validateFileHeaders(worksheet);
    const fileData = xlsx.utils.sheet_to_json(worksheet);
    const userFile: IFileUser[] = fileData.map(
      (userData: Partial<ICreateUserFile>) => ({
        user: {
          ...userData,
          ...(userData.cpf
            ? {
                cpf: fixCpfZeroes
                  ? String(userData.cpf).padStart(11, '0')
                  : userData.cpf,
              }
            : {}),
        },
        errors: {},
      }),
    );
    return userFile;
  }

  /**
   * Validate if file has expected headers
   */
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

  async validateCreateFileValues(userFile: IFileUser[]) {
    /** Row 1 = header, how 2-N = users */
    let row = 2;
    for (let i = 0; i < userFile.length; i++) {
      const currentFileUser = userFile[i];
      // Code
      const schema = plainToClass(CreateUserFileDto, currentFileUser.user);
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
        currentFileUser.user.email ||
        currentFileUser.user.codigo_permissionario ||
        currentFileUser.user.cpf
      ) {
        const dbFoundUsers = await this.findMany({
          where: [
            ...(currentFileUser.user.email
              ? [{ email: currentFileUser.user.email }]
              : []),
            ...(currentFileUser.user.codigo_permissionario
              ? [{ permitCode: currentFileUser.user.codigo_permissionario }]
              : []),
            ...(currentFileUser.user.cpf
              ? [{ cpfCnpj: currentFileUser.user.cpf }]
              : []),
          ],
        });
        if (dbFoundUsers.length > 0) {
          for (const dbField of fields) {
            const dtoField = FileUserMap[dbField];
            if (
              dbFoundUsers.find(
                (i) => i[dbField] === currentFileUser.user[dtoField],
              )
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
      const existingFileUser = userFile.filter(
        (i) =>
          i.user.email === currentFileUser.user.email ||
          i.user.codigo_permissionario ===
            currentFileUser.user.codigo_permissionario ||
          i.user.cpf === currentFileUser.user.cpf,
      );
      if (existingFileUser.length > 1) {
        for (const dbField of fields) {
          const dtoField = FileUserMap[dbField];
          const existingFUserByField = existingFileUser.filter(
            (i) => i.user[dbField] === currentFileUser.user[dbField],
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
      //
      userFile[i] = {
        row: row,
        ...currentFileUser,
        errors: errorDictionary,
      };
      row++;
    }
  }

  async validateUpdateFileValues(userFile: IFileUser[]) {
    /** Row 1 = header, how 2-N = users */
    let row = 2;
    // const existingPermitCodes = await this.findMany({
    //   where: {
    //     permitCode: In(userFile.map((i) => i.user.codigo_permissionario)),
    //   },
    // });

    for (let i = 0; i < userFile.length; i++) {
      const currentFileUser = userFile[i];
      // Code
      const schema = plainToClass(UpdateUserFileDto, currentFileUser.user);
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
      const fields = ['permitCode'];

      // If doesnt have another db user with permitCode to update
      // if (currentFileUser.user.codigo_permissionario) {
      //   for (const dbField of fields) {
      //     const dtoField = FileUserMap[dbField];
      //     if (
      //       !existingPermitCodes.find(
      //         (i) => i[dbField] === currentFileUser.user[dtoField],
      //       )
      //     ) {
      //       if (!errorDictionary.hasOwnProperty(dtoField)) {
      //         errorDictionary[dtoField] = '';
      //       }
      //       if (errorDictionary[dtoField].length > 0) {
      //         errorDictionary[dtoField] += SEPARATOR;
      //       }
      //       errorDictionary[dtoField] += userUploadEnum.FIELD_NOT_EXISTS;
      //     }
      //   }
      // }

      // If has another user in upload with same email OR permitCode OR cpfCnpj
      const existingFileUser = userFile.filter(
        (i) =>
          i.user.email === currentFileUser.user.email ||
          i.user.codigo_permissionario ===
            currentFileUser.user.codigo_permissionario ||
          i.user.cpf === currentFileUser.user.cpf,
      );
      if (existingFileUser.length > 1) {
        for (const dbField of fields) {
          const dtoField = FileUserMap[dbField];
          const existingFUserByField = existingFileUser.filter(
            (i) => i.user[dbField] === currentFileUser.user[dbField],
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
      //
      userFile[i] = {
        row: row,
        ...currentFileUser,
        errors: errorDictionary,
      };
      row++;
    }
  }

  // #endregion

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
