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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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
}
