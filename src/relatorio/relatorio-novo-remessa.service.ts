import { Injectable } from '@nestjs/common';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { RelatorioConsolidadoRepository } from './relatorio-consolidado.repository';
import { RelatorioConsolidadoResultDto } from './dtos/relatorio-consolidado-result.dto';
import { RelatorioAnaliticoResultDto } from './dtos/relatorio-analitico-result.dto';
import { RelatorioSinteticoResultDto } from './dtos/relatorio-sintetico-result.dto';
import { RelatorioAnaliticoRepository } from './relatorio-analitico.repository';
import { RelatorioSinteticoRepository } from './relatorio-sintetico.repository';
import { IFindPublicacaoRelatorioNovoRemessa } from './interfaces/find-publicacao-relatorio-novo-remessa.interface';
import { RelatorioConsolidadoNovoRemessaDto } from './dtos/relatorio-consolidado-novo-remessa.dto';
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

  async findSintetico(args: IFindPublicacaoRelatorioNovoRemessa){
    if(args.dataInicio ===undefined || args.dataFim === undefined || 
      new Date(args.dataFim) < new Date(args.dataInicio)){
      throw new Error('Parametro de data inválido');
    }

    let result: RelatorioSinteticoResultDto[]=[];
    return result;
  }

}
