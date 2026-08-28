import { Injectable } from '@nestjs/common';

import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import { RelatorioNovoRemessaConsolidadoRepository } from './relatorio-novo-remessa-consolidado.repository';
import { RelatorioNovoRemessaMovimentacaoRepository } from './relatorio-novo-remessa-movimentacao.repository';

@Injectable()
export class RelatorioNovoRemessaService {
  constructor(    
    private relatorioNovoRemessaConsolidadoRepository: RelatorioNovoRemessaConsolidadoRepository,
     private relatorioNovoRemessaMovimentacaoRepository: RelatorioNovoRemessaMovimentacaoRepository,
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

   async findMovimentacaoFinanceira(args: IFindPublicacaoRelatorioNovoRemessa) {
    if (args.dataInicio === undefined || args.dataFim === undefined || new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioNovoRemessaMovimentacaoRepository.findMovimentacao(args);
  }
}
