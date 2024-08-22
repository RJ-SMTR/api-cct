import { Injectable } from '@nestjs/common';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { RelatorioRepository } from './relatorio.repository';
import { RelatorioConsolidadoResultDto } from './dtos/relatorio-consolidado-result.dto';
import { RelatorioAnaliticoResultDto } from './dtos/relatorio-analitico-result.dto';

@Injectable()
export class RelatorioService {
  constructor(private relatorioRepository: RelatorioRepository) {}

  /**
   * Gerar relatórios consolidados - agrupados por Favorecido.
   */
  async findConsolidado(args: IFindPublicacaoRelatorio) {    
    let result: RelatorioConsolidadoResultDto[]=[];
   
    if(args.dataInicio ===undefined || args.dataFim === undefined || 
      new Date(args.dataFim) < new Date(args.dataInicio)){
      throw new Error('Parametro de data inválido');
    }

    if(args.pago === undefined && args.aPagar === undefined && (args.favorecidoNome ===undefined) 
      && (args.consorcioNome === undefined)){
      result.push(await this.resultConsolidado(args));
      result.push(await this.resultPago(args));
      result.push(await this.resultErros(args));
      result.push(await this.resultApagar(args));
    }else if(args.pago === true && args.aPagar === true){
      result.push(await this.resultPago(args));
      result.push(await this.resultApagar(args));
    }else if(args.pago ===true) {
      result.push(await this.resultPago(args));
    }else if(args.pago ===false) {
      result.push(await this.resultErros(args));
    }else if(args.aPagar === true){
      result.push(await this.resultApagar(args));
    }else{
      result.push(await this.resultConsolidado(args));
    }    
    return result;
  }

  private async resultConsolidado(args: IFindPublicacaoRelatorio){
    let consolidado  = await this.relatorioRepository.findConsolidado(args);
    const consolidadosData = new RelatorioConsolidadoResultDto();
    consolidadosData.count = consolidado.length;
    consolidadosData.data = consolidado;
    consolidadosData.valor = +consolidado.reduce((s, i) => s + i.valor, 0).toFixed(2); 
    consolidadosData.status = 'todos';
    return consolidadosData;
  }

  private async resultPago(args: IFindPublicacaoRelatorio){
      args.pago = true;
      let consolidadosPagos  = await this.relatorioRepository.findConsolidado(args);
      const consolidadoPagoData = new RelatorioConsolidadoResultDto();
      consolidadoPagoData.count = consolidadosPagos.length;
      consolidadoPagoData.data = consolidadosPagos;
      consolidadoPagoData.valor = +consolidadosPagos.reduce((s, i) => s + i.valor, 0).toFixed(2); 
      consolidadoPagoData.status = 'pago';
      return consolidadoPagoData;
  }

  private async resultErros(args: IFindPublicacaoRelatorio){
    args.pago = false;
    let consolidadosErros  = await this.relatorioRepository.findConsolidado(args);
    const consolidadosErrosData = new RelatorioConsolidadoResultDto();
    consolidadosErrosData.count = consolidadosErros.length;
    consolidadosErrosData.data = consolidadosErros;
    consolidadosErrosData.valor = +consolidadosErros.reduce((s, i) => s + i.valor, 0).toFixed(2); 
    consolidadosErrosData.status = 'Erros';
    return consolidadosErrosData;
  }

  private async resultApagar(args: IFindPublicacaoRelatorio){
    args.aPagar = true;      
    let consolidadosAPagar  = await this.relatorioRepository.findConsolidado(args);
    const consolidadosaPagarData = new RelatorioConsolidadoResultDto();
    consolidadosaPagarData.count = consolidadosAPagar.length;
    consolidadosaPagarData.data = consolidadosAPagar;
    consolidadosaPagarData.valor = +consolidadosAPagar.reduce((s, i) => s + i.valor, 0).toFixed(2); 
    consolidadosaPagarData.status = 'aPagar';
    return consolidadosaPagarData;
  }
    

  async findAnalitico(args: IFindPublicacaoRelatorio){
    const d = 2;
    let result: RelatorioAnaliticoResultDto[]=[];
    
    let analitcoPagos; 
    if(args.pago === true && (args.aPagar === false || args.aPagar === undefined)){  
      
    }

    let analitcoNaoPagos;   
    if(args.pago === false && (args.aPagar === false || args.aPagar === undefined)){  
    }

    let analitcoAPagar;
    if(args.aPagar === true && (args.pago === false || args.pago === undefined)){

    }
    let analitico;
    if(args.aPagar === undefined && args.pago === undefined){
    
    }
    return result;
  }
}
