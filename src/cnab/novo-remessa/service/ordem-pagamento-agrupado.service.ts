import { Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { AllPagadorDict } from 'src/cnab/interfaces/pagamento/all-pagador-dict.interface';
import { PagadorService } from 'src/cnab/service/pagamento/pagador.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { Between, DataSource } from 'typeorm';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { OrdemPagamentoAgrupadoRepository } from '../repository/ordem-pagamento-agrupado.repository';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { BigQueryToOrdemPagamento } from '../convertTo/bigquery-to-ordem-pagamento.convert';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { OrdemPagamentoAgrupadoHistoricoRepository } from '../repository/ordem-pagamento-agrupado-historico.repository';

@Injectable()
export class OrdemPagamentoAgrupadoService {
 
  private logger = new CustomLogger(OrdemPagamentoAgrupadoService.name, { timestamp: true });

  constructor(  
    private ordemPamentoRepository: OrdemPagamentoRepository, 
    private ordemPamentoAgrupadoRepository: OrdemPagamentoAgrupadoRepository,
    private ordemPamentoAgrupadoHistRepository: OrdemPagamentoAgrupadoHistoricoRepository,
    private pagadorService: PagadorService,  
  ) {}   
 
  async prepararPagamentoAgrupados(dataOrdemInicial: Date, dataOrdemFinal: Date,dataPgto:Date, pagadorKey: keyof AllPagadorDict) {
    this.logger.debug(`Preparando agrupamentos`)
    const ordens = await this.ordemPamentoRepository.findAll({ dataOrdem: Between(dataOrdemInicial, dataOrdemFinal) });
    const pagador = await this.getPagador(pagadorKey);
    if(pagador){
      await this.saveAll(ordens,pagador,dataPgto);  
    }
  }

  async getPagador(pagadorKey: any) {
     const conta = (await this.pagadorService.getAllPagador())[pagadorKey];
     return await this.pagadorService.findByConta(conta);
  } 

  async save(ordem: BigqueryOrdemPagamentoDTO, userId: number) {
    const ordemPagamento = BigQueryToOrdemPagamento.convert(ordem, userId);
    await this.ordemPamentoRepository.save(ordemPagamento);
  }

  async saveAll(ordens: OrdemPagamento[], pagador: Pagador,dataPgto:Date){
    for (const ordem of ordens) {
      let ordemPagamentoAgrupado = await this.verificaOrdemPagamento(ordem,dataPgto);      
      if (!ordemPagamentoAgrupado) {
        ordemPagamentoAgrupado = new OrdemPagamentoAgrupado();        
        ordemPagamentoAgrupado.createdAt = new Date();
      }else{       

      }

      ordemPagamentoAgrupado.valorTotal += ordem.valor;      
      ordemPagamentoAgrupado.pagador = pagador;       
      ordemPagamentoAgrupado.updatedAt = new Date();

      ordemPagamentoAgrupado.ordensPagamento.push(ordem);
      await this.ordemPamentoAgrupadoRepository.save(ordemPagamentoAgrupado);
    }
  }  

  async verificaOrdemPagamento(ordem:OrdemPagamento,dataPgto:Date){
    return await this.ordemPamentoAgrupadoRepository.findOne(
      { ordensPagamento: [{ idOperadora: ordem.idOperadora }],
        dataPagamento: dataPgto });
  }

  async getOrdens(dataInicio: Date, dataFim: Date, consorcio: string[] | undefined) {
    return this.ordemPamentoAgrupadoRepository.findAllCustom(dataInicio,dataFim,consorcio);
  }
}