import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { Pagador } from '../entity/pagador.entity';
import { PagadorContaEnum } from '../enums/pagador/pagador.enum';
import { PagadorRepository } from '../repository/pagador.repository';

@Injectable()
export class PagadorService {
  private logger: Logger = new Logger('PagadorService', { timestamp: true });

  constructor(
    private usersService: UsersService,
    private pagadorRepository: PagadorRepository,
  ) {}

  public async findById(id: PagadorContaEnum | number) {
    return await this.pagadorRepository.findOne({ id_pagador: id });
  }

  public async getOneById(id: PagadorContaEnum | number): Promise<Pagador> {
    const pagador = await this.pagadorRepository.findOne({ id_pagador: id });
    if (!pagador) {
      throw CommonHttpException.notFound(
        'Pagador.pagador_id',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      return pagador;
    }
  }
}
