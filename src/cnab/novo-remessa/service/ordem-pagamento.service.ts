import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { BigQueryToOrdemPagamento } from '../convertTo/bigquery-to-ordem-pagamento.convert';
import { User } from 'src/users/entities/user.entity';
import { OrdemPagamentoSemanalDto } from '../dto/ordem-pagamento-semanal.dto';
import { OrdemPagamentoMensalDto } from '../dto/ordem-pagamento-mensal.dto';
import { OrdemPagamentoPendenteNuncaRemetidasDto } from '../dto/ordem-pagamento-pendente-nunca-remetidas.dto';
import { OrdemPagamentoAgrupadoMensalDto } from '../dto/ordem-pagamento-agrupado-mensal.dto';
import { replaceUndefinedWithNull } from '../../../utils/type-utils';
import { endOfDay, isValid, startOfDay } from 'date-fns';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { BigqueryOrdemPagamentoGuardadorDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento-guardador.dto';
import { OrdemPagamentoGuardadorRepository } from '../repository/ordem-pagamento-guardador.repository';
import { OrdemPagamentoGuardador } from '../entity/ordem-pagamento-guardador.entity';

/** Mesma lista sincronizada pelo cron (CronJobsService.CONSORCIOS + MODAIS). */
export const CONSORCIOS_E_MODAIS_SINCRONIZADOS = [
  'VLT', 'Intersul', 'Transcarioca', 'Internorte', 'MobiRio', 'Santa Cruz', 'MOBI-Rio BUM', 'TUSE', 'GTU',
  'STPC', 'STPL', 'TEC',
];

/** Limite de dias do sincronismo manual, para uma chamada não varrer o BigQuery inteiro. */
export const MAX_DIAS_SINCRONISMO_MANUAL = 31;

export interface ResultadoSincronismoOrdens {
  dataInicio: string;
  dataFim: string;
  encontradasNoBigQuery: number;
  inseridas: number;
  puladoPorContagemIgual: boolean;
}

@Injectable()
export class OrdemPagamentoService {
 

  private logger = new CustomLogger(OrdemPagamentoService.name, { timestamp: true });

  constructor(private ordemPagamentoRepository: OrdemPagamentoRepository, 
    private ordemPagamentoGuardadorRepository: OrdemPagamentoGuardadorRepository,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService, private usersService: UsersService) { }

  /** Ids locais de ordem_pagamento -> ids do BigQuery, para consultar transações. */
  async converterParaBqIds(ids: (number | undefined)[]): Promise<number[]> {
    return this.ordemPagamentoRepository.findBqIdsByIds(ids.filter((id): id is number => id != null).map(Number));
  }

  /**
   * Busca no BigQuery as ordens capturadas entre as datas (pela data de captura) e grava as que
   * ainda não existem localmente (identificadas por bqId). É idempotente: reexecutar não duplica.
   *
   * @param forcar ignora o atalho "número de ordens local == BigQuery", que deixa passar uma ordem
   *               faltante quando a contagem local por acaso bate com a do BigQuery.
   */
  async sincronizarOrdensPagamento(
    dataCapturaInicialDate: Date,
    dataCapturaFinalDate: Date,
    consorcio: string[],
    forcar = false,
  ): Promise<ResultadoSincronismoOrdens> {
    const METHOD = 'sincronizarOrdensPagamento';
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataCapturaInicialDate, dataCapturaFinalDate, 0, { consorcioName: consorcio });

    const numOrdensSemana = await this.findNumeroDeOrdensPorIntervalo(startOfDay(dataCapturaInicialDate), endOfDay(dataCapturaFinalDate));
    // Verifica se a ultima data de captura é igual a data atual
    // E se o número de ordens é diferente.
    const resultado: ResultadoSincronismoOrdens = {
      dataInicio: dataCapturaInicialDate.toISOString().slice(0, 10),
      dataFim: dataCapturaFinalDate.toISOString().slice(0, 10),
      encontradasNoBigQuery: ordens.length,
      inseridas: 0,
      puladoPorContagemIgual: false,
    };
    if (!forcar && numOrdensSemana === ordens.length) {
      this.logger.log(`Já foi feita a captura de ordens de pagamento para o dia de hoje.`, METHOD);
      resultado.puladoPorContagemIgual = true;
      return resultado;
    }

    this.logger.debug(`Iniciando sincronismo de ${ordens.length} ordens`, METHOD);

    for (const ordem of ordens) {
      let user: User | undefined;
      if (ordem.operadoraCpfCnpj) {
        try {
          /*
              Caso sejam modais, obtemos o usuário pelo CPF/CNPJ.
              Caso contrário, obtemos pelo idConsorcio === permitCode
           */
          if (ordem.consorcio === 'STPC' || ordem.consorcio === 'STPL' || ordem.consorcio === 'TEC') {
            user = await this.usersService.getOne({ cpfCnpj: ordem.operadoraCpfCnpj });
          } else {
            user = await this.usersService.getOne({ permitCode: ordem.idConsorcio });
          }
          if (user && !user.bloqueado) {
            this.logger.debug(`Salvando a ordem: ${ordem.idOrdemPagamento} para usuario: ${user.fullName}`, METHOD);
            await this.save(ordem, user.id);
          }
        } catch (error) {
          /***  TODO: Caso o erro lançado seja relacionado ao fato do usuário não ter sido encontrado,
           ajustar o código para inserir a ordem de pagamento com o usuário nulo
           ***/
          if (error instanceof HttpException && !user) {
            await this.save(ordem, undefined);
          } else {
            this.logger.error(`Erro ao sincronizar ordem de pagamento ${ordem.id}: ${error.message}`, METHOD);
          }
        }
      }
    }
    this.logger.debug(`Sincronizado ${ordens.length} ordens`, METHOD);
    const depois = await this.findNumeroDeOrdensPorIntervalo(startOfDay(dataCapturaInicialDate), endOfDay(dataCapturaFinalDate));
    resultado.inseridas = Math.max(0, (depois ?? numOrdensSemana ?? 0) - (numOrdensSemana ?? 0));
    return resultado;
  }

  /**
   * Sincronismo manual de um intervalo de datas de captura, para recuperar ordens que o cron não
   * trouxe (janela errada, ordem gerada depois). Sempre força a busca e aceita no máximo
   * MAX_DIAS_SINCRONISMO_MANUAL dias. Não agrupa nada: o agrupamento continua sendo o fluxo normal.
   */
  async sincronizarOrdensPorPeriodo(dataInicio: Date, dataFim: Date, consorcio?: string[]): Promise<ResultadoSincronismoOrdens> {
    if (!isValid(dataInicio) || !isValid(dataFim)) {
      throw new HttpException({ error: 'Datas inválidas.' }, HttpStatus.BAD_REQUEST);
    }
    if (dataInicio > dataFim) {
      throw new HttpException({ error: 'dataInicio deve ser menor ou igual a dataFim.' }, HttpStatus.BAD_REQUEST);
    }
    const dias = Math.round((dataFim.getTime() - dataInicio.getTime()) / 86_400_000) + 1;
    if (dias > MAX_DIAS_SINCRONISMO_MANUAL) {
      throw new HttpException({ error: `O período máximo é de ${MAX_DIAS_SINCRONISMO_MANUAL} dias (pedido: ${dias}).` }, HttpStatus.BAD_REQUEST);
    }
    return this.sincronizarOrdensPagamento(dataInicio, dataFim, consorcio?.length ? consorcio : CONSORCIOS_E_MODAIS_SINCRONIZADOS, true);
  }

  async sincronizarOrdensPagamentoGuardador(dataCapturaInicialDate: Date, dataCapturaFinalDate: Date) {
    const METHOD = 'sincronizarOrdensPagamentoGuardador';
    //const ordens = await this.bigqueryOrdemPagamentoService.getFromWeekOrdemGuardador(dataCapturaInicialDate, dataCapturaFinalDate, 0);

    // const numOrdensSemana = await this.findNumeroDeOrdensPorIntervaloGuardador(startOfDay(dataCapturaInicialDate), endOfDay(dataCapturaFinalDate));
    // // Verifica se a ultima data de captura é igual a data atual
    // // E se o número de ordens é diferente.
    // if (numOrdensSemana === ordens.length) {
    //   this.logger.log(`Já foi feita a captura de ordens de pagamento para o dia de hoje.`, METHOD);
    //   return;
    // }

    const ordens = await this.ordemPagamentoGuardadorRepository.findOrdensPorPeriodo(dataCapturaInicialDate, dataCapturaFinalDate);

    this.logger.debug(`Iniciando sincronismo de ${ordens.length} ordens`, METHOD);

    for (const ordem of ordens) {
      let user: User | undefined;
      if (ordem.idOrdemPagamento) {
        try {
          user = await this.usersService.getOne({ cpfCnpj: ordem.idOrdemPagamento });          
          if (user && !user.bloqueado) {
            this.logger.debug(`Salvando para usuario: ${user.fullName}`, METHOD);
           // await this.saveOrdemGuardador(ordem,user.id);
            ordem.user = user;
            await this.ordemPagamentoGuardadorRepository.save(ordem);
          }
        } catch (error) {
          /***  TODO: Caso o erro lançado seja relacionado ao fato do usuário não ter sido encontrado,
           ajustar o código para inserir a ordem de pagamento com o usuário nulo
           ***/
          if (error instanceof HttpException && !user) {
           // await this.saveOrdemGuardador(ordem,undefined);
          } else {
            this.logger.error(`Erro ao sincronizar ordem de pagamento guardador ${ordem.dataOrdem}: ${error.message}`, METHOD);
          }
        }
      }
    }
    this.logger.debug(`Sincronizado ${ordens.length} ordens`, METHOD);
  }

  async save(ordem: BigqueryOrdemPagamentoDTO, userId: number | undefined) {
    const ordemPagamento = BigQueryToOrdemPagamento.convert(ordem, userId);
    await this.ordemPagamentoRepository.save(ordemPagamento);
  }

   async saveOrdemGuardador(ordem: BigqueryOrdemPagamentoGuardadorDTO, userId: number | undefined) {
    const ordemPagamento = BigQueryToOrdemPagamento.convertOrdemGuardador(ordem, userId);
    await this.ordemPagamentoGuardadorRepository.save(ordemPagamento);
  }

  async findOrdensPagamentoAgrupadasPorMes(userId: number, yearMonth: Date): Promise<OrdemPagamentoMensalDto> {
    const ordensDoMes = await this.ordemPagamentoRepository.findOrdensPagamentoAgrupadasPorMes(userId, yearMonth);
    const ordemPagamentoMensal = new OrdemPagamentoMensalDto();
    ordemPagamentoMensal.ordens = ordensDoMes.map((ordem) => {
      const o = new OrdemPagamentoAgrupadoMensalDto();
      o.ordemPagamentoAgrupadoIds = ordem.ordemPagamentoAgrupadoIds;
      o.ordemPagamentoAgrupadoId = ordem.ordemPagamentoAgrupadoId;
      o.motivoStatusRemessa = ordem.motivoStatusRemessa;
      o.valorTotal = ordem.valorTotal;
      o.statusRemessa = ordem.statusRemessa;
      o.descricaoMotivoStatusRemessa = ordem.descricaoMotivoStatusRemessa;
      o.descricaoStatusRemessa = ordem.descricaoStatusRemessa;
      o.data = ordem.data;
      o.dataPagamento = ordem.dataPagamento;
      replaceUndefinedWithNull(o);
      return o;
    });
    ordemPagamentoMensal.valorTotal = ordensDoMes.reduce((acc, ordem) => acc + (ordem.valorTotal || 0), 0);
    ordemPagamentoMensal.valorTotalPago = ordensDoMes.reduce((acc, ordem) => {
      if (ordem.motivoStatusRemessa &&
        (ordem.motivoStatusRemessa.toString() === '00' || ordem.motivoStatusRemessa.toString() === 'BD')) {
        return acc + (ordem.valorTotal || 0);
      }
      return acc;
    }, 0);
    return ordemPagamentoMensal;
  }

  async findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds: string, userId: number): Promise<OrdemPagamentoSemanalDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds, userId);
  }

  async findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds: string, userId: number, endDateParam?: Date): Promise<OrdemPagamentoSemanalDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoIds, userId, endDateParam);
  }

  async findOrdensPagamentosPendentesQueNuncaForamRemetidas(userId?: number | undefined): Promise<OrdemPagamentoPendenteNuncaRemetidasDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentosPendentesQueNuncaForamRemetidas(userId);
  }

  async findOrdensPagamentoDiasAnterioresByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId: number, userId: number): Promise<OrdemPagamentoSemanalDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentoDiasAnterioresByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId, userId);
  }

  async findNumeroDeOrdensPorIntervalo(startDate: Date, endDate: Date) {
    return await this.ordemPagamentoRepository.findNumeroOrdensPorIntervaloDataCaptura(startDate, endDate);
  }

  async findNumeroDeOrdensPorIntervaloGuardador(startDate: Date, endDate: Date) {
    return await this.ordemPagamentoGuardadorRepository.findNumeroOrdensPorIntervaloDataCaptura(startDate, endDate);
  }

  async findOrdensAgrupadas(dataInicio: Date, dataFim: Date, consorcios: string[]): Promise<OrdemPagamento[]> {
    return this.ordemPagamentoRepository.findOrdensAgrupadas(dataInicio, dataFim, consorcios);
  }

  async findOrdensAgrupadasGuardador(dataInicio: Date, dataFim: Date): Promise<OrdemPagamentoGuardador[]> {
   return this.ordemPagamentoGuardadorRepository.findOrdensAgrupadas(dataInicio, dataFim);
  }

  async removerAgrupamentos(consorcios: string[], ids: string) {
    await this.ordemPagamentoRepository.removerAgrupamento(consorcios, ids)
  }

   async removerAgrupamentosGuardador(ids: string) {
    await this.ordemPagamentoGuardadorRepository.removerAgrupamento(ids)
  }

  public async getOrdensPendentes(dataInicio: Date, dataFim: Date, nomes: string[]) {
    return await this.ordemPagamentoRepository.findOrdensPagamentosPendentes(dataInicio, dataFim, nomes)
  }

}
