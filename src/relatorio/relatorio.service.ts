import { Injectable } from '@nestjs/common';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { RelatorioRepository } from './relatorio.repository';
import { RelatorioConsolidadoResultDto } from './dtos/relatorio-consolidado-result.dto';

@Injectable()
export class RelatorioService {
  constructor(private relatorioRepository: RelatorioRepository) {}

  /**
   * Gerar relatórios consolidados - agrupados por Favorecido.
   */
  async findConsolidado(args: IFindPublicacaoRelatorio) {
    const d = 2;
    let result: RelatorioConsolidadoResultDto[]=[];
    let consolidadosPagos;
    if(args.pago === true && (args.aPagar === false || args.aPagar === undefined)){    
       consolidadosPagos  = await this.relatorioRepository.findConsolidado(args);
       const consolidadoPagoData = new RelatorioConsolidadoResultDto();
       consolidadoPagoData.count = consolidadosPagos.length;
       consolidadoPagoData.data = consolidadosPagos;
       consolidadoPagoData.valor = +consolidadosPagos.reduce((s, i) => s + i.valor, 0).toFixed(d); 
       consolidadoPagoData.status = 'pago';
       result.push(consolidadoPagoData);
    }

    let consolidadosNaoPagos;
    if(args.pago === false && (args.aPagar === false || args.aPagar === undefined)){        
      consolidadosNaoPagos  = await this.relatorioRepository.findConsolidado(args);
      const consolidadosNaoPagosData = new RelatorioConsolidadoResultDto();
      consolidadosNaoPagosData.count = consolidadosNaoPagos.length;
      consolidadosNaoPagosData.data = consolidadosNaoPagos;
      consolidadosNaoPagosData.valor = +consolidadosNaoPagos.reduce((s, i) => s + i.valor, 0).toFixed(d); 
      consolidadosNaoPagosData.status = 'naoPago';
      result.push(consolidadosNaoPagosData);
    }

    let consolidadosApagar;
    if(args.aPagar === true && (args.pago === false || args.pago === undefined)){
      consolidadosApagar  = await this.relatorioRepository.findConsolidado(args);
      const consolidadosaPagarData = new RelatorioConsolidadoResultDto();
      consolidadosaPagarData.count = consolidadosApagar.length;
      consolidadosaPagarData.data = consolidadosApagar;
      consolidadosaPagarData.valor = +consolidadosApagar.reduce((s, i) => s + i.valor, 0).toFixed(d); 
      consolidadosaPagarData.status = 'aPagar';
      result.push(consolidadosaPagarData);
    }
    
    let consolidado;
    if(args.aPagar === undefined && args.pago === undefined){
      consolidado  = await this.relatorioRepository.findConsolidado(args);
      const consolidadosData = new RelatorioConsolidadoResultDto();
      consolidadosData.count = consolidado.length;
      consolidadosData.data = consolidado;
      consolidadosData.valor = +consolidado.reduce((s, i) => s + i.valor, 0).toFixed(d); 
      consolidadosData.status = 'todos';
      result.push(consolidadosData);
    }
    return result;
  }
}
