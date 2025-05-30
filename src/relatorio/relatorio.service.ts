import { Injectable } from '@nestjs/common';

import { RelatorioConsolidadoResultDto } from './dtos/relatorio-consolidado-result.dto';
import { RelatorioAnaliticoResultDto } from './dtos/relatorio-analitico-result.dto';
import { RelatorioSinteticoResultDto } from './dtos/relatorio-sintetico-result.dto';

import { RelatorioExtratoBancarioDto } from './dtos/relatorio-extrato-bancario.dto';
import { RelatorioExtratoBancarioRepository } from './extrato-bancario/relatorio-extrato-bancario.repository';
import { RelatorioAnaliticoRepository } from './analitico/relatorio-analitico.repository';
import { RelatorioConsolidadoRepository } from './consolidado/relatorio-consolidado.repository';
import { IFindExtrato } from './interfaces/find-extrato.interface';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { RelatorioSinteticoRepository } from './sintetico/relatorio-sintetico.repository';
import { RelatorioExtratoBancarioResponseDto } from './dtos/relatorio-extrato-bancario-response.dto';

@Injectable()
export class RelatorioService {
  constructor(private relatorioConsolidadoRepository: RelatorioConsolidadoRepository,
    private relatorioSinteticoRepository: RelatorioSinteticoRepository,
    private relatorioAnaliticoRepository: RelatorioAnaliticoRepository,
    private relatorioExtratoRepository: RelatorioExtratoBancarioRepository
  ) {}

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
    return this.instanceDataConsolidado(args,'pago');
  }

  private async resultErros(args: IFindPublicacaoRelatorio){
    return this.instanceDataConsolidado(args,'erros');
  }

  private async resultApagar(args: IFindPublicacaoRelatorio){   
    return this.instanceDataConsolidado(args,'aPagar');
  }    

  private async instanceDataConsolidado(args: IFindPublicacaoRelatorio,status:string){
    const consolidado  = await this.relatorioConsolidadoRepository.findConsolidado(args);
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
    result.push(await this.resultSintetico(args));   
    return result;
  }

   ///////EXTRATO //////
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


 
  private async resultSintetico(args: IFindPublicacaoRelatorio){    
    return this.instanceDataSintetico(args,'todos');
  }  

  private async instanceDataSintetico(args: IFindPublicacaoRelatorio,status:string){
    const sintetico  = await this.relatorioSinteticoRepository.findSintetico(args); 
    const sintenticosData = new RelatorioSinteticoResultDto();
    sintenticosData.count = sintetico.length;
    sintenticosData.data = sintetico;
    sintenticosData.valor = (sintetico!==undefined && sintetico[0]!==undefined)?sintetico[0].total:0;
    sintenticosData.status = status;
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
      return this.instanceDataAnalitico(args,'pago');
  }

  private async resultErrosAnalitico(args: IFindPublicacaoRelatorio){
    return this.instanceDataAnalitico(args,'erros');
  }

  private async resultApagarAnalitico(args: IFindPublicacaoRelatorio){    
    return this.instanceDataAnalitico(args,'aPagar');
  } 

  private async instanceDataAnalitico(args: IFindPublicacaoRelatorio,status:string){
    const analitico  = await this.relatorioAnaliticoRepository.findAnalitico(args);
    const analiticosData = new RelatorioAnaliticoResultDto();
    analiticosData.count = analitico.length;
    analiticosData.data = analitico;
    analiticosData.valor = +analitico.reduce((s, i) => s + i.valorTransacao, 0).toFixed(2); 
    analiticosData.status = status
    return analiticosData;
  }
}
