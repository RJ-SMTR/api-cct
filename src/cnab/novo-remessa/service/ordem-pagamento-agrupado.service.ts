import { Injectable } from '@nestjs/common';
import { AllPagadorDict } from 'src/cnab/interfaces/pagamento/all-pagador-dict.interface';
import { PagadorService } from 'src/cnab/service/pagamento/pagador.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamentoAgrupadoRepository } from '../repository/ordem-pagamento-agrupado.repository';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { OrdemPagamentoAgrupadoHistoricoRepository } from '../repository/ordem-pagamento-agrupado-historico.repository';
import { OrdemPagamentoAgrupadoHistorico } from '../entity/ordem-pagamento-agrupado-historico.entity';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { OrdemPagamentoAgrupadoHistoricoDTO } from '../dto/ordem-pagamento-agrupado-historico.dto';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import { DiscordService } from '../../service/discord/discord.service';

@Injectable()
export class OrdemPagamentoAgrupadoService {  

  private logger = new CustomLogger(OrdemPagamentoAgrupadoService.name, { timestamp: true });

  constructor(  
    private ordemPagamentoRepository: OrdemPagamentoRepository, 
    private ordemPagamentoAgrupadoRepository: OrdemPagamentoAgrupadoRepository,
    private ordemPagamentoAgrupadoHistRepository: OrdemPagamentoAgrupadoHistoricoRepository,
    private pagadorService: PagadorService,
    private discordService: DiscordService
  ) {}   
 
  async prepararPagamentoAgrupados(dataOrdemInicial: Date, dataOrdemFinal: Date, dataPgto:Date,
     pagadorKey: keyof AllPagadorDict,consorcios:string[]) {
    this.logger.debug(`Preparando agrupamentos`)
    const pagador = await this.getPagador(pagadorKey);
    try {
      if (pagador) {
        this.logger.log(`Agrupando ordens de pagamento para o pagador ${pagador.id}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${dataOrdemFinal}, consorcios ${consorcios}`);
        await this.agruparOrdens(dataOrdemInicial, dataOrdemFinal, dataPgto, pagador, consorcios);
        this.logger.log(`Ordens agrupadas para o pagador ${pagador}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${dataOrdemFinal}`);
        await this.discordService.sendMessage(`Ordens agrupadas para o pagador ${pagador.id}, data de pagamento ${dataPgto.toLocaleDateString()}, data de ordem inicial ${dataOrdemInicial.toLocaleDateString()}, data de ordem final ${dataOrdemFinal.toLocaleDateString()}`);
      } else {
        this.logger.error(`Pagador não encontrado para a chave ${pagadorKey}`);
        await this.discordService.sendMessage(`Pagador não encontrado para a chave ${pagadorKey}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao agrupar ordens de pagamento para o pagador ${pagador.id}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${dataOrdemFinal}, consorcios ${consorcios}`);
      await this.discordService.sendMessage(`Erro ao agrupar ordens de pagamento para o pagador ${pagador.id}, data de pagamento ${dataPgto.toLocaleString()}, data de ordem inicial ${dataOrdemInicial.toLocaleString()}, data de ordem final ${dataOrdemFinal.toLocaleString()}, consorcios ${consorcios}`);
    }
  }
 
  private async agruparOrdens(dataInicial: Date, dataFinal: Date, dataPgto:Date, pagador: Pagador,consorcios: string[]) {
    await this.ordemPagamentoRepository.agruparOrdensDePagamento(dataInicial, dataFinal, dataPgto, pagador,consorcios);
  }

  async getOrdens(dataInicio: Date, dataFim: Date,dataPgto:Date, consorcio: string[] | undefined) {
    return await this.ordemPagamentoAgrupadoRepository.findAllCustom(dataInicio,dataFim,dataPgto,consorcio);
  }


  async getHistoricosOrdem(idOrdem: number){
    return await this.ordemPagamentoAgrupadoHistRepository.findAll({ ordemPagamentoAgrupado: { id: idOrdem } });
  }  

  async saveStatusHistorico(historico: OrdemPagamentoAgrupadoHistorico,statusRemessa:StatusRemessaEnum){
    historico.statusRemessa = statusRemessa;
    historico.dataReferencia = new Date();
    await this.ordemPagamentoAgrupadoHistRepository.save(historico);
  }

  private async getPagador(pagadorKey: any) {
    return (await this.pagadorService.getAllPagador())[pagadorKey];
  } 

  public async getOrdemPagamento(idOrdemPagamentoAg: number){
    return await this.ordemPagamentoRepository.findOne({ordemPagamentoAgrupado:{ id: idOrdemPagamentoAg}  })
  }

  public async getHistoricosOrdemDetalheA(id: number) {
    return await this.ordemPagamentoAgrupadoHistRepository.getHistoricoDetalheA(id)
  }

  public async getHistorico(id: number) {
    return await this.ordemPagamentoAgrupadoHistRepository.getHistorico(id)
  }
}