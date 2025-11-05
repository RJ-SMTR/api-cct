import { Injectable } from '@nestjs/common';

import { OrdemPagamentoAgrupadoRepository } from '../repository/ordem-pagamento-agrupado.repository';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { OrdemPagamentoAgrupadoHistoricoRepository } from '../repository/ordem-pagamento-agrupado-historico.repository';
import { OrdemPagamentoAgrupadoHistorico } from '../domain/entity/ordem-pagamento-agrupado-historico.entity';
import { Pagador } from 'src/domain/entity/pagador.entity';
import { StatusRemessaEnum } from 'src/domain/enum/status-remessa.enum';
import { AllPagadorDict } from 'src/domain/interface/all-pagador-dict.interface';
import { CustomLogger } from 'src/utils/custom-logger';
import { PagadorService } from './pagador.service';

@Injectable()
export class OrdemPagamentoAgrupadoService {

  private logger = new CustomLogger(OrdemPagamentoAgrupadoService.name, { timestamp: true });

  constructor(
    private ordemPagamentoRepository: OrdemPagamentoRepository,
    private ordemPagamentoAgrupadoRepository: OrdemPagamentoAgrupadoRepository,
    private ordemPagamentoAgrupadoHistRepository: OrdemPagamentoAgrupadoHistoricoRepository,
    private pagadorService: PagadorService,
  ) { }

  async prepararPagamentoAgrupados(dataOrdemInicial: Date, dataOrdemFinal: Date, dataPgto: Date,
    pagadorKey: keyof AllPagadorDict, consorcios: string[]) {
    this.logger.debug(`Preparando agrupamentos`)
    const pagador = await this.getPagador(pagadorKey);
    if (pagador) {
      this.logger.log(`Agrupando ordens de pagamento para o pagador ${pagador}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${dataOrdemFinal}, consorcios ${consorcios}`);
      await this.agruparOrdens(dataOrdemInicial, dataOrdemFinal, dataPgto, pagador, consorcios);
      this.logger.log(`Ordens agrupadas para o pagador ${pagador}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${dataOrdemFinal}`);
    }
  }

  async prepararPagamentoAgrupadosPendentes(dataOrdemInicial: Date, dataOrdemFinal: Date, dataPgto: Date,
    pagadorKey: keyof AllPagadorDict, idOperadoras?: string[]) {

    this.logger.debug(`Preparando agrupamentos Pendentes`)
    const pagador = await this.getPagador(pagadorKey);

    if (pagador) {
      if (dataOrdemInicial.getFullYear() === 2024 && dataOrdemFinal.getFullYear() === 2025) {
        this.logger.log(`Detectado período entre anos (2024-2025). Executando agrupamento em duas etapas.`);

        // First grouping: from initial date to end of 2024
        const endOf2024 = new Date(2024, 11, 31); // December 31, 2024
        this.logger.log(`Agrupando ordens de pagamento para o pagador ${pagador}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${endOf2024}, idOperadoras ${idOperadoras} (Período 2024)`);
        await this.agruparOrdensPendentes(dataOrdemInicial, endOf2024, dataPgto, pagador, idOperadoras);
        this.logger.log(`Ordens agrupadas para o pagador ${pagador} - Período 2024 concluído`);

        // Second grouping: from start of 2025 to final date
        const startOf2025 = new Date(2025, 0, 1); // January 1, 2025
        this.logger.log(`Agrupando ordens de pagamento para o pagador ${pagador}, data de pagamento ${dataPgto}, data de ordem inicial ${startOf2025}, data de ordem final ${dataOrdemFinal}, idOperadoras ${idOperadoras} (Período 2025)`);
        await this.agruparOrdensPendentes(startOf2025, dataOrdemFinal, dataPgto, pagador, idOperadoras);
        this.logger.log(`Ordens agrupadas para o pagador ${pagador} - Período 2025 concluído`);
      } else {
        // Normal single grouping for same year or other cases
        this.logger.log(`Agrupando ordens de pagamento para o pagador ${pagador}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${dataOrdemFinal}, idOperadoras ${idOperadoras}`);
        await this.agruparOrdensPendentes(dataOrdemInicial, dataOrdemFinal, dataPgto, pagador, idOperadoras);
        this.logger.log(`Ordens agrupadas para o pagador ${pagador}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${dataOrdemFinal}`);
      }
    }
  }

  async prepararPagamentoAgrupadosUnico(dataOrdemInicial: Date, dataOrdemFinal: Date, dataPgto: Date,
    pagadorKey: keyof AllPagadorDict, consorcios: string[]) {
    this.logger.debug(`Preparando agrupamentos pagamento único`)
    const pagador = await this.getPagador(pagadorKey);
    if (pagador) {
      this.logger.log(`Agrupando ordens de pagamento para o pagador ${pagador}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${dataOrdemFinal}, consorcios ${consorcios}`);
      await this.agruparOrdemUnica(dataOrdemInicial, dataOrdemFinal, dataPgto, pagador);
      this.logger.log(`Ordens agrupadas para o pagador ${pagador}, data de pagamento ${dataPgto}, data de ordem inicial ${dataOrdemInicial}, data de ordem final ${dataOrdemFinal}`);
    }
  }

  private async agruparOrdens(dataInicial: Date, dataFinal: Date, dataPgto: Date, pagador: Pagador, consorcios: string[]) {
    await this.ordemPagamentoRepository.agruparOrdensDePagamento(dataInicial, dataFinal, dataPgto, pagador, consorcios);
  }

  private async agruparOrdemUnica(dataInicial: Date, dataFinal: Date, dataPgto: Date, pagador: Pagador) {
    await this.ordemPagamentoRepository.agruparOrdensDePagamentoUnico(dataInicial, dataFinal, dataPgto, pagador);
  }

  async getOrdens(dataInicio: Date, dataFim: Date, consorcio: string[] | undefined, dataPagamento?: Date ) {
    return await this.ordemPagamentoAgrupadoRepository.findAllCustom(dataInicio, dataFim, consorcio, dataPagamento);
  }
  async getOrdensPendentes(dataInicio: Date, dataFim: Date, consorcio: string[] | undefined, dataPagamento?: Date, idOperadoras?: string[] ) {
    return await this.ordemPagamentoAgrupadoRepository.findAllPendente(dataInicio, dataFim, consorcio, dataPagamento, idOperadoras);
  }

  async getOrdensUnicas(dataInicio: Date, dataFim: Date, dataPgto: Date) {
    return await this.ordemPagamentoAgrupadoRepository.findAllUnica(dataInicio, dataFim, dataPgto);
  }

  async getHistoricosOrdem(idOrdem: number) {
    return await this.ordemPagamentoAgrupadoHistRepository.findAll({ ordemPagamentoAgrupado: { id: idOrdem } });
  }

  async saveStatusHistorico(historico: OrdemPagamentoAgrupadoHistorico, statusRemessa: StatusRemessaEnum) {
    historico.statusRemessa = statusRemessa;
    historico.dataReferencia = new Date();
    await this.ordemPagamentoAgrupadoHistRepository.save(historico);
  }


  private async agruparOrdensPendentes(dataInicial: Date, dataFinal: Date, dataPgto: Date, pagador: Pagador, nomes?: string[]) {
    await this.ordemPagamentoRepository.agruparOrdensDePagamentoPendentes(dataInicial, dataFinal, dataPgto, pagador, nomes);
    // await this.ordemPagamentoRepository.agruparOrdensDeEstornadosRejeitados(dataInicial, dataFinal, dataPgto, pagador, nomes);
  }
  private async getPagador(pagadorKey: any) {
    return (await this.pagadorService.getAllPagador())[pagadorKey];
  }

  public async getOrdemPagamento(idOrdemPagamentoAg: number) {
    return await this.ordemPagamentoRepository.findOne({ ordemPagamentoAgrupado: { id: idOrdemPagamentoAg } })
  }

  public async getOrdemPagamentoAgrupado(idOrdemPagamentoAg: number) {
    return await this.ordemPagamentoRepository.findCustom(idOrdemPagamentoAg)
  }
  public async getOrdemPagamentoAgrupadoChild(idOrdemPagamentoAg: number) {
    return await this.ordemPagamentoRepository.findCustomChild(idOrdemPagamentoAg)
  }
  public async getOrdemPagamentoAgrupadoRepo(idOrdemPagamentoAg: number) {
    return await this.ordemPagamentoAgrupadoRepository.findOnePai({ id: idOrdemPagamentoAg });
  }

  public async getOrdemPagamentoUnico(idOrdemPagamentoAg: number) {
    return await this.ordemPagamentoRepository.findOrdemUnica(idOrdemPagamentoAg);
  }

  public async getHistoricosOrdemDetalheA(id: number, pagamentoUnico?: boolean, isPendente?: boolean) {
    return await this.ordemPagamentoAgrupadoHistRepository.getHistoricoDetalheA(id, pagamentoUnico, isPendente)
  }

  public async getHistorico(id: number) {
    return await this.ordemPagamentoAgrupadoHistRepository.getHistorico(id)
  }

  public async getHistoricoUnico(id: number) {
    return await this.ordemPagamentoAgrupadoHistRepository.getHistoricoUnico(id)
  }

  async excluirHistorico(ids: string) {
    await this.ordemPagamentoAgrupadoHistRepository.excluirHistorico(ids);
  }

  async excluirOrdensAgrupadas(ids: string) {
    await this.ordemPagamentoAgrupadoRepository.excluirPorIds(ids)
  }
}
