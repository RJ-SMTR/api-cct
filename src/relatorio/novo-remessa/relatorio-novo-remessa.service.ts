import { Injectable } from '@nestjs/common';

import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import { RelatorioNovoRemessaConsolidadoRepository } from './relatorio-novo-remessa-consolidado.repository';
import { RelatorioNovoRemessaMovimentacaoRepository } from './relatorio-novo-remessa-movimentacao.repository';
import { RelatorioExtratoBancarioResponseDto } from '../dtos/relatorio-extrato-bancario-response.dto';
import { IFindExtrato } from '../interfaces/find-extrato.interface';
import { RelatorioExtratoBancarioRepository } from '../extrato-bancario/relatorio-extrato-bancario.repository';

@Injectable()
export class RelatorioNovoRemessaService {
  constructor(    
    private relatorioNovoRemessaConsolidadoRepository: RelatorioNovoRemessaConsolidadoRepository,
    private relatorioNovoRemessaMovimentacaoRepository: RelatorioNovoRemessaMovimentacaoRepository,
    private relatorioExtratoRepository: RelatorioExtratoBancarioRepository  ) {}

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

  async findExtrato(args: IFindExtrato){
    if(args.dataInicio ===undefined || args.dataFim === undefined || 
      new Date(args.dataFim) < new Date(args.dataInicio)){
      throw new Error('Parametro de data inválido');
    }   

    const extrato = await this.relatorioExtratoRepository.findExtrato(args)

    const response  = new RelatorioExtratoBancarioResponseDto();

    response.extrato = extrato;

    response.saldoConta = extrato[extrato.length - 1]?.valorSaldoInicial ?? 0;

    return response;
  }
}
