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
import { CreateUserExcelDto } from './dto/create-user-excel.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { FileUserInterface } from './interfaces/file-user.interface';
import { ExcelUserMap } from './mappings/excel-user.map';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>, // private baseValidator: BaseValidator,
  ) {}

  create(createProfileDto: CreateUserDto): Promise<User> {
    return this.usersRepository.save(
      this.usersRepository.create(createProfileDto),
    );
  }

  findManyWithPagination(
    paginationOptions: IPaginationOptions,
  ): Promise<User[]> {
    return this.usersRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });
  }

  findOne(fields: EntityCondition<User>): Promise<NullableType<User>> {
    return this.usersRepository.findOne({
      where: fields,
    });
  }

  update(id: number, payload: DeepPartial<User>): Promise<User> {
    return this.usersRepository.save(
      this.usersRepository.create({
        id,
        ...payload,
      }),
    );
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

  async getExcelUsersFromWorksheet(
    worksheet: xlsx.WorkSheet,
    expectedUserFields: string[],
    validatorDto,
  ): Promise<FileUserInterface[]> {
    const expectedExcelUserFields: string[] = expectedUserFields.map(
      (str) => ExcelUserMap[str] || str,
    );
    const headers: any[] = [];
    for (const key in worksheet) {
      if (worksheet.hasOwnProperty(key)) {
        if (key.endsWith('1')) {
          headers.push(worksheet[key].v);
        }
      }
    }
    if (!expectedExcelUserFields.every((item1) => headers.includes(item1))) {
      throw new HttpException(
        {
          error: {
            file: {
              message: 'inivalidHeaders',
              receivedHeaders: headers,
              expectedHeaders: expectedExcelUserFields,
            },
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const excelData = xlsx.utils.sheet_to_json(worksheet);
    const excelUsers: FileUserInterface[] = excelData.map((item) => ({
      user: {
        permitCode: (item as any).codigo_permissionario,
        email: (item as any).email,
      },
      errors: {},
    }));
    let row = 2;
    for (let i = 0; i < excelUsers.length; i++) {
      const excelUser = excelUsers[i];
      const schema = plainToClass(validatorDto, excelUser.user);
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
      excelUsers[i] = {
        row: row,
        ...excelUser,
        errors: errorDictionary,
      };
      row++;
    }
    return excelUsers;
  }

  async createFromFile(file: Express.Multer.File): Promise<any> {
    const worksheet = this.getWorksheetFromFile(file);
    const expectedUserFields = ['permitCode', 'email'];
    const fileUsers = await this.getExcelUsersFromWorksheet(
      worksheet,
      expectedUserFields,
      CreateUserExcelDto,
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
              headerMap: ExcelUserMap,
              invalidRows: invalidUsers,
            },
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    for (const excelUser of fileUsers) {
      await this.usersRepository.save(
        this.usersRepository.create(excelUser.user),
      );
    }
    return HttpStatus.CREATED;
  }
}
