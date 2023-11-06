import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { Request } from 'express';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Status } from 'src/statuses/entities/status.entity';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { Enum } from 'src/utils/enum';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { DeepPartial, FindOptionsWhere, ILike, Repository } from 'typeorm';
import * as xlsx from 'xlsx';
import { NullableType } from '../utils/types/nullable.type';
import { CreateFileUserDto } from './dto/create-file-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { FileUserInterface } from './interfaces/file-user.interface';
import { IFindUserPaginated } from './interfaces/find-user-paginated.interface';
import { FileUserMap } from './mappings/file-user.map';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private inviteService: MailHistoryService,
  ) {}

  create(createProfileDto: CreateUserDto): Promise<User> {
    return this.usersRepository.save(
      this.usersRepository.create(createProfileDto),
    );
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
    const where = [
      ...(fields?.name || fields?._anyField?.value
        ? [
            {
              fullName: ILike(`%${fields?.name || fields?._anyField?.value}%`),
            },
            {
              firstName: ILike(`%${fields?.name || fields?._anyField?.value}%`),
            },
            {
              lastName: ILike(`%${fields?.name || fields?._anyField?.value}%`),
            },
          ]
        : []),
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

    let users = await this.usersRepository.find({
      ...(fields ? { where: where } : {}),
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    let invites: NullableType<MailHistory[]> = null;
    if (inviteStatus) {
      invites = await this.inviteService.find({ inviteStatus });
    }

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (user !== null) {
        user.aux_inviteStatus = await this.getAux_inviteSatus(user);
      }
      users[i] = user;
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

  private async getAux_inviteSatus(
    user: User | null,
  ): Promise<InviteStatus | null> {
    const invite = await this.inviteService.findRecentByUser(user);
    let inviteStatus: InviteStatus | null = null;
    if (invite?.inviteStatus !== undefined) {
      inviteStatus = invite.inviteStatus;
    }
    return inviteStatus;
  }

  async findOne(fields: EntityCondition<User>): Promise<NullableType<User>> {
    const user = await this.usersRepository.findOne({
      where: fields,
    });
    if (user !== null) {
      user.aux_inviteStatus = await this.getAux_inviteSatus(user);
    }
    return user;
  }

  async update(id: number, payload: DeepPartial<User>): Promise<User> {
    const oldUser = await this.getOne({ id });
    const newUser = new User(oldUser);
    newUser.update(payload);

    if (newUser.email !== oldUser.email) {
      const inviteFound = await this.inviteService.findOne({
        email: newUser.email as string,
      });
      if (!inviteFound) {
        const hash = await this.inviteService.generateHash();
        await this.inviteService.create({
          user: newUser,
          hash,
          email: newUser.email as string,
          inviteStatus: {
            id: InviteStatusEnum.queued,
          },
        });
      } else if (inviteFound.user.id !== newUser.id) {
        const inviteUser = await this.getOne({ id: inviteFound.user.id });
        throw new HttpException(
          {
            error: `invite email already exists:. ${JSON.stringify({
              permitCode: inviteUser.permitCode,
              email: inviteUser.email,
              fullName: inviteUser.fullName,
            })})`,
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      await this.usersRepository.save(this.usersRepository.create(newUser));
      newUser.aux_inviteStatus = await this.getAux_inviteSatus(newUser);
    }

    return newUser;
  }

  async softDelete(id: number): Promise<void> {
    await this.usersRepository.softDelete(id);
  }

  /**
   * @throws `HttpException`
   */
  async getOne(fields: EntityCondition<User>): Promise<User> {
    const user = await this.findOne(fields);
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
    user.aux_inviteStatus = await this.getAux_inviteSatus(user);
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
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
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

  async getFileUsersFromWorksheet(
    worksheet: xlsx.WorkSheet,
    expectedUserFields: string[],
    validatorDto,
  ): Promise<FileUserInterface[]> {
    const expectedFileUserFields: string[] = expectedUserFields.map(
      (str) => FileUserMap[str] || str,
    );
    const receivedHeaders: any[] = [];
    for (const key in worksheet) {
      if (worksheet.hasOwnProperty(key)) {
        if (key.endsWith('1')) {
          receivedHeaders.push(worksheet[key].v);
        }
      }
    }
    if (
      !receivedHeaders.every((item1) => expectedFileUserFields.includes(item1))
    ) {
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

    const fileData = xlsx.utils.sheet_to_json(worksheet);
    const fileUsers: FileUserInterface[] = fileData.map((item) => ({
      user: {
        permitCode: (item as any).codigo_permissionario.replace("'", ''),
        email: (item as any).email,
      },
      errors: {},
    }));
    let row = 2;
    for (let i = 0; i < fileUsers.length; i++) {
      const fileUser = fileUsers[i];
      const schema = plainToClass(validatorDto, fileUser.user);
      const errors = await validate(schema as Record<string, any>, {
        stopAtFirstError: true,
      });
      const errorDictionary: { [field: string]: string[] } = errors.reduce(
        (result, error) => {
          const { property, constraints } = error;
          if (property && constraints) {
            result[property] = Object.values(constraints)[0];
          }
          return result;
        },
        {},
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

  async createFromFile(file: Express.Multer.File): Promise<any> {
    const worksheet = this.getWorksheetFromFile(file);
    const expectedUserFields = ['permitCode', 'email'];
    const fileUsers = await this.getFileUsersFromWorksheet(
      worksheet,
      expectedUserFields,
      CreateFileUserDto,
    );
    const invalidUsers = fileUsers.filter(
      (i) => Object.keys(i.errors).length > 0,
    );
    if (invalidUsers.length > 0) {
      throw new HttpException(
        {
          error: {
            file: {
              message: 'invalidRows',
              headerMap: FileUserMap,
              invalidRows: invalidUsers,
            },
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    for (const fileUser of fileUsers) {
      const hash = await this.inviteService.generateHash();
      const createdUser = this.usersRepository.create({
        ...fileUser.user,
        hash: hash,
        status: new Status(StatusEnum.register),
        role: new Role(RoleEnum.user),
      } as DeepPartial<User>);
      await this.usersRepository.save(createdUser);

      await this.inviteService.create({
        user: createdUser,
        hash: hash,
        email: createdUser.email as string,
        inviteStatus: {
          id: InviteStatusEnum.queued,
        },
      });
    }
    return HttpStatus.CREATED;
  }
}
