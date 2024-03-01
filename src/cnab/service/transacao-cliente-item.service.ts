import { Injectable, Logger } from '@nestjs/common';
import { TransacaoClienteItemRepository } from '../repository/transacao-cliente-item.repository';

@Injectable()
export class TransacaoClienteItemService {
  private logger: Logger = new Logger('TransacaoClienteItemService', {
    timestamp: true,
  });

  constructor(private pagadorRepository: TransacaoClienteItemRepository) {}

  public async getAll() {
    return await this.pagadorRepository.findMany({});
  }

  // public async createIfNotExists(id_transacao: number, ): Promise<TransacaoClienteItem> {
  //   const pagador = await this.pagadorRepository.findOne({ conta: conta });
  //   if (!pagador) {
  //     throw CommonHttpException.errorDetails(
  //       'TransacaoClienteItem.conta not found',
  //       { pagadorConta: conta },
  //       HttpStatus.NOT_FOUND,
  //     );
  //   } else {
  //     return pagador;
  //   }
  // }
}
