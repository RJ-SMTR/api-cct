import { Injectable } from '@nestjs/common';
import { AllPagadorDict } from 'src/cnab/interfaces/pagamento/all-pagador-dict.interface';
import { PagadorService } from 'src/cnab/service/pagamento/pagador.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { OrdemPagamentoAgrupadoRepository } from '../repository/ordem-pagamento-agrupado.repository';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { OrdemPagamentoAgrupadoHistoricoRepository } from '../repository/ordem-pagamento-agrupado-historico.repository';
import { OrdemPagamentoAgrupadoHistorico } from '../entity/ordem-pagamento-agrupado-historico.entity';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';


@Injectable()
export class OrdemPagamentoAgrupadoService {

  private logger = new CustomLogger(OrdemPagamentoAgrupadoService.name, { timestamp: true });

  constructor(  
    private ordemPamentoRepository: OrdemPagamentoRepository, 
    private ordemPamentoAgrupadoRepository: OrdemPagamentoAgrupadoRepository,
    private ordemPamentoAgrupadoHistRepository: OrdemPagamentoAgrupadoHistoricoRepository,
    private pagadorService: PagadorService,
  ) {}   
 
  async prepararPagamentoAgrupados(dataOrdemInicial: Date, dataOrdemFinal: Date, dataPgto:Date, pagadorKey: keyof AllPagadorDict) {
    this.logger.debug(`Preparando agrupamentos`)
    const pagador = await this.getPagador(pagadorKey);
    if(pagador) {
      await this.agruparOrdens(dataOrdemInicial, dataOrdemFinal, dataPgto, pagador);
    }
  }

  async getPagador(pagadorKey: any) {
    return (await this.pagadorService.getAllPagador())[pagadorKey];
  } 

  async agruparOrdens(dataInicial: Date, dataFinal: Date, dataPgto:Date, pagador: Pagador) {
    await this.ordemPamentoRepository.agruparOrdensDePagamento(dataInicial, dataFinal, dataPgto, pagador);
  }

  async getOrdens(dataInicio: Date, dataFim: Date, consorcio: string[] | undefined) {
    return await this.ordemPamentoAgrupadoRepository.findAllCustom(dataInicio,dataFim,consorcio);
  }

  async getUltimoHistoricoOrdem(ordemPagamento:OrdemPagamentoAgrupado){
    return this.ordemPamentoAgrupadoHistRepository.findOne({ 
      ordemPagamentoAgrupado:{ id:  ordemPagamento.id }
    });
  }

  async saveStatusHistorico(historico: OrdemPagamentoAgrupadoHistorico,statusRemessa:StatusRemessaEnum){
    historico.statusRemessa = statusRemessa;    
    this.ordemPamentoAgrupadoHistRepository.save(historico);
  }

}