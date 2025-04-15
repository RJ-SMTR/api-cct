import { Injectable } from '@nestjs/common';
import { RelatorioNovoRemessaPayAndPendingRepository } from './relatorio-novo-remessa-pay-and-pending.repository';
import { IFindPublicacaoRelatorioNovoPayAndPending } from './interfaces/filter-publicacao-relatorio-novo-pay-and-pending.interface';

@Injectable()
export class RelatorioNovoRemessaPayAndPendingService {
  constructor(private relatorioNovoRemessaPayAndPendingRepository: RelatorioNovoRemessaPayAndPendingRepository,
  ) { }

  /**
   * Gerar relatórios payandpending - agrupados por Favorecido.
   */
  async findPayAndPending(args: IFindPublicacaoRelatorioNovoPayAndPending) {
    if (args.dataInicio === undefined || args.dataFim === undefined ||
      new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioNovoRemessaPayAndPendingRepository.findPayAndPending(args);
  }


}
