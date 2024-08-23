import { Injectable } from '@nestjs/common';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { RelatorioRepository } from './relatorio.repository';
import { RelatorioConsolidadoResultDto } from './dtos/relatorio-consolidado-result.dto';
import { RelatorioAnaliticoResultDto } from './dtos/relatorio-analitico-result.dto';
import { RelatorioConsolidadoDto } from './dtos/relatorio-consolidado.dto';
import { RelatorioSinteticoResultDto } from './dtos/relatorio-sintetico-result.dto';

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
    return this.instanceDataConsolidado(args,'todos');
  }

  private async resultPago(args: IFindPublicacaoRelatorio){
      args.pago = true;    
      return this.instanceDataConsolidado(args,'pago');
  }

  private async resultErros(args: IFindPublicacaoRelatorio){
    args.pago = false;
    return this.instanceDataConsolidado(args,'erros');
  }

  private async resultApagar(args: IFindPublicacaoRelatorio){
    args.aPagar = true;      
    return this.instanceDataConsolidado(args,'aPagar');
  }    

  private async instanceDataConsolidado(args: IFindPublicacaoRelatorio,status:string){
    const consolidado  = await this.relatorioRepository.findConsolidado(args);
    const consolidadosData = new RelatorioConsolidadoResultDto();
    consolidadosData.count = consolidado.length;
    consolidadosData.data = consolidado;
    consolidadosData.valor = +consolidado.reduce((s, i) => s + i.valor, 0).toFixed(2); 
    consolidadosData.status = status
    return consolidadosData;
  }
 
  ///////SINTETICO //////

  async findSintetico(args: IFindPublicacaoRelatorio){
    if(args.dataInicio ===undefined || args.dataFim === undefined || 
      new Date(args.dataFim) < new Date(args.dataInicio)){
      throw new Error('Parametro de data inválido');
    }

    let result: RelatorioSinteticoResultDto[]=[];
    
    if(args.pago === undefined && args.aPagar === undefined && (args.favorecidoNome ===undefined) 
      && (args.consorcioNome === undefined)){
      result.push(await this.resultSintetico(args));
      result.push(await this.resultPagoSintetico(args));
      result.push(await this.resultErrosSintetico(args));
      result.push(await this.resultApagarSintetico(args));
    }else if(args.pago === true && args.aPagar === true){
      result.push(await this.resultPagoSintetico(args));
      result.push(await this.resultApagarSintetico(args));
    }else if(args.pago ===true) {
      result.push(await this.resultPagoSintetico(args));
    }else if(args.pago ===false) {
      result.push(await this.resultErrosSintetico(args));
    }else if(args.aPagar === true){
      result.push(await this.resultApagarSintetico(args));
    }else{
      result.push(await this.resultSintetico(args));
    }
    return result;
  }

  private async resultSintetico(args: IFindPublicacaoRelatorio){    
    return this.instanceDataSintetico(args,'todos');
  }

  private async resultPagoSintetico(args: IFindPublicacaoRelatorio){
      args.pago = true;    
      return this.instanceDataSintetico(args,'pago');
  }

  private async resultErrosSintetico(args: IFindPublicacaoRelatorio){
    args.pago = false;
    return this.instanceDataSintetico(args,'erros');
  }

  private async resultApagarSintetico(args: IFindPublicacaoRelatorio){
    args.aPagar = true;      
    return this.instanceDataSintetico(args,'aPagar');
  } 

  private async instanceDataSintetico(args: IFindPublicacaoRelatorio,status:string){
    const sintetico  = await this.relatorioRepository.findSintetico(args);
    const sintenticosData = new RelatorioSinteticoResultDto();
    sintenticosData.count = sintetico.length;
    sintenticosData.data = sintetico;
    sintenticosData.valor = +sintetico.reduce((s, i) => s + i.valor, 0).toFixed(2); 
    sintenticosData.status = status
    return sintenticosData;
  }


  ///////////////////////
  ///////ANALITICO //////

  async findAnalitico(args: IFindPublicacaoRelatorio){
    if(args.dataInicio ===undefined || args.dataFim === undefined || 
      new Date(args.dataFim) < new Date(args.dataInicio)){
      throw new Error('Parametro de data inválido');
    }

    let result: RelatorioAnaliticoResultDto[]=[];
    
    if(args.pago === undefined && args.aPagar === undefined && (args.favorecidoNome ===undefined) 
      && (args.consorcioNome === undefined)){
      result.push(await this.resultAnalitico(args));
      result.push(await this.resultPagoAnalitico(args));
      result.push(await this.resultErrosAnalitico(args));
      result.push(await this.resultApagarAnalitico(args));
    }else if(args.pago === true && args.aPagar === true){
      result.push(await this.resultPagoAnalitico(args));
      result.push(await this.resultApagarAnalitico(args));
    }else if(args.pago ===true) {
      result.push(await this.resultPagoAnalitico(args));
    }else if(args.pago ===false) {
      result.push(await this.resultErrosAnalitico(args));
    }else if(args.aPagar === true){
      result.push(await this.resultApagarAnalitico(args));
    }else{
      result.push(await this.resultAnalitico(args));
    }
    return result;
  }

  private async resultAnalitico(args: IFindPublicacaoRelatorio){    
    return this.instanceDataAnalitico(args,'todos');
  }

  private async resultPagoAnalitico(args: IFindPublicacaoRelatorio){
      args.pago = true;    
      return this.instanceDataAnalitico(args,'pago');
  }

  private async resultErrosAnalitico(args: IFindPublicacaoRelatorio){
    args.pago = false;
    return this.instanceDataAnalitico(args,'erros');
  }

  private async resultApagarAnalitico(args: IFindPublicacaoRelatorio){
    args.aPagar = true;      
    return this.instanceDataAnalitico(args,'aPagar');
  } 

  private async instanceDataAnalitico(args: IFindPublicacaoRelatorio,status:string){
    const analitico  = await this.relatorioRepository.findAnalitico(args);
    const analiticosData = new RelatorioAnaliticoResultDto();
    analiticosData.count = analitico.length;
    analiticosData.data = analitico;
    analiticosData.valor = +analitico.reduce((s, i) => s + i.valorTransacao, 0).toFixed(2); 
    analiticosData.status = status
    return analiticosData;
  }
}
