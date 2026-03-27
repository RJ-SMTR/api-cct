import { Injectable } from '@nestjs/common';

import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import { RelatorioNovoRemessaRepository } from './relatorio-novo-remessa.repository';
import { RelatorioNovoRemessaConsolidadoRepository } from './relatorio-novo-remessa-consolidado.repository';

@Injectable()
export class RelatorioNovoRemessaService {
  constructor(
    private relatorioNovoRemessaRepository: RelatorioNovoRemessaRepository,
    private relatorioNovoRemessaConsolidadoRepository: RelatorioNovoRemessaConsolidadoRepository,
  ) {}

  /**
   * Gerar relatórios consolidados - agrupados por Favorecido.
   */
  async findConsolidado(args: IFindPublicacaoRelatorioNovoRemessa) {
    if (args.dataInicio === undefined || args.dataFim === undefined || new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioNovoRemessaConsolidadoRepository.findConsolidado(args);
  }

  ///////SINTETICO //////

  async findSintetico(args: IFindPublicacaoRelatorioNovoRemessa) {
    if (args.dataInicio === undefined || args.dataFim === undefined || new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return await this.relatorioNovoRemessaRepository.findSintetico(args);
  }
}
