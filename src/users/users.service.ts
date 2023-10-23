import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { DeepPartial, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { NullableType } from '../utils/types/nullable.type';
import { HttpErrorMessages } from 'src/utils/enums/http-error-messages.enum';
import { Request } from 'express';
import * as xlsx from 'xlsx';
import * as crypto from 'crypto';
import { CreateFileUserDto } from './dto/create-file-user.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { FileUserInterface } from './interfaces/file-user.interface';
import { FileUserMap } from './mappings/file-user.map';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { InviteService } from 'src/invite/invite.service';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { InviteStatusEnum } from 'src/invite-statuses/invite-status.enum';
import { InviteStatus } from 'src/invite-statuses/entities/invite-status.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Role } from 'src/roles/entities/role.entity';
import { Status } from 'src/statuses/entities/status.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private inviteService: InviteService,
  ) {}

  create(createProfileDto: CreateUserDto): Promise<User> {
    return this.usersRepository.save(
      this.usersRepository.create(createProfileDto),
    );
  }

  async findManyWithPagination(
    paginationOptions: IPaginationOptions,
  ): Promise<User[]> {
    const users = await this.usersRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (user !== null) {
        user.aux_inviteStatus = await this.getAux_inviteSatus(user);
      }
      users[i] = user;
    }
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
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        id,
        ...payload,
      }),
    );
    user.aux_inviteStatus = await this.getAux_inviteSatus(user);
    return user;
  }

  async softDelete(id: number): Promise<void> {
    await this.usersRepository.softDelete(id);
  }

  async getOne(fields: EntityCondition<User>): Promise<User> {
    const user = await this.findOne(fields);
    if (!user) {
      throw new HttpException(
        {
          error: HttpErrorMessages.UNAUTHORIZED,
          details: {
            ...(!user && { user: 'userNotFound' }),
          },
        },
        HttpStatus.UNAUTHORIZED,
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
      const hash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');
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
        inviteStatus: new InviteStatus(InviteStatusEnum.created),
      });
    }
    return HttpStatus.CREATED;
  }
}
