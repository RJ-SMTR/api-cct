import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Pagador } from '../domain/entity/pagador.entity';
import { PagadorContaEnum } from '../domain/enum/pagador.enum';
import { PagadorRepository } from '../repository/pagador.repository';
import { AllPagadorDict } from 'src/domain/interface/all-pagador-dict.interface';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';

@Injectable()
export class PagadorService {
  private logger: Logger = new Logger('PagadorService', { timestamp: true });

  constructor(private pagadorRepository: PagadorRepository) { }


  /**
   * Get a dictionary with all pagador to be used as reference.
   */
  public async getAllPagador(): Promise<AllPagadorDict> {
    return {
      cett: await this.getOneByConta(PagadorContaEnum.CETT),
      contaBilhetagem: await this.getOneByConta(PagadorContaEnum.ContaBilhetagem),
    }
  }

  public async findByConta(conta: PagadorContaEnum | string) {
    return await this.pagadorRepository.findOne({ conta: conta });
  }

  public async getByConta(conta: PagadorContaEnum | string): Promise<Pagador> {
    const pagador = await this.pagadorRepository.findOne({ conta: conta });
    if (!pagador) {
      throw CommonHttpException.errorDetails(
        'Pagador.conta not found',
        { pagadorConta: conta },
        HttpStatus.NOT_FOUND,
      );
    } else {
      return pagador;
    }
  }

  public async getOneByConta(
    conta: PagadorContaEnum | string,
  ): Promise<Pagador> {
    const pagador = await this.pagadorRepository.findOne({ conta: conta });
    if (!pagador) {
      throw CommonHttpException.errorDetails(
        'Pagador.conta not found',
        { pagadorConta: conta },
        HttpStatus.NOT_FOUND,
      );
    } else {
      return pagador;
    }
  }

  public async getOneByIdPagador(
    id_pagador: number,
  ): Promise<Pagador> {
    const pagador = await this.pagadorRepository.findOne({ id: id_pagador });
    if (!pagador) {
      throw CommonHttpException.errorDetails(
        'Pagador.conta not found',
        { pagadorConta: id_pagador },
        HttpStatus.NOT_FOUND,
      );
    } else {
      return pagador;
    }
  }
}