import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { Pagador } from '../entity/pagador.entity';
import { PagadorContaEnum } from '../enums/pagador/pagador.enum';
import { PagadorRepository } from '../repository/pagador.repository';
import { Nullable } from 'src/utils/types/nullable.type';

@Injectable()
export class PagadorService {
  private logger: Logger = new Logger('PagadorService', { timestamp: true });

  constructor(private pagadorRepository: PagadorRepository) {}

  public async findByConta(conta: PagadorContaEnum | string) {
    return await this.pagadorRepository.findOne({ conta: conta });
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
}