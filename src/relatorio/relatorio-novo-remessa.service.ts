import { Injectable } from '@nestjs/common';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { RelatorioSinteticoResultDto } from './dtos/relatorio-sintetico-result.dto';
import { IFindPublicacaoRelatorioNovoRemessa } from './interfaces/find-publicacao-relatorio-novo-remessa.interface';
import { RelatorioNovoRemessaRepository } from './relatorio-novo-remessa.repository';

@Injectable()
export class RelatorioNovoRemessaService {
  constructor(private relatorioNovoRemessaRepository: RelatorioNovoRemessaRepository,
  ) {}

  /**
   * Gerar relatórios consolidados - agrupados por Favorecido.
   */
  async findConsolidado(args: IFindPublicacaoRelatorioNovoRemessa) {
    if(args.dataInicio ===undefined || args.dataFim === undefined || 
      new Date(args.dataFim) < new Date(args.dataInicio)){
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioNovoRemessaRepository.findConsolidado(args);
  }
 
  ///////SINTETICO //////

  async findSintetico(args: IFindPublicacaoRelatorio){
    if(args.dataInicio ===undefined || args.dataFim === undefined || 
      new Date(args.dataFim) < new Date(args.dataInicio)){
      throw new Error('Parametro de data inválido');
    }

    let result: RelatorioSinteticoResultDto[]=[];
    return result;
  }

}
