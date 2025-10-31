import { HttpException, Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/client/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/client/bigquery/services/bigquery-ordem-pagamento.service';
import { UsersService } from 'src/service/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { BigQueryToOrdemPagamento } from '../domain/convertTo/bigquery-to-ordem-pagamento.convert';
import { OrdemPagamentoSemanalDto } from '../domain/dto/ordem-pagamento-semanal.dto';
import { OrdemPagamentoMensalDto } from '../domain/dto/ordem-pagamento-mensal.dto';
import { OrdemPagamentoPendenteNuncaRemetidasDto } from '../domain/dto/ordem-pagamento-pendente-nunca-remetidas.dto';
import { OrdemPagamentoAgrupadoMensalDto } from '../domain/dto/ordem-pagamento-agrupado-mensal.dto';
import { replaceUndefinedWithNull } from '../utils/type-utils';
import { endOfDay, startOfDay } from 'date-fns';
import { OrdemPagamento } from '../domain/entity/ordem-pagamento.entity';
import { User } from 'src/domain/entity/user.entity';

@Injectable()
export class OrdemPagamentoService {

  private logger = new CustomLogger(OrdemPagamentoService.name, { timestamp: true });

  constructor(private ordemPagamentoRepository: OrdemPagamentoRepository, private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService, private usersService: UsersService) { }

  async sincronizarOrdensPagamento(dataCapturaInicialDate: Date, dataCapturaFinalDate: Date, consorcio: string[]) {
    const METHOD = 'sincronizarOrdensPagamento';
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataCapturaInicialDate, dataCapturaFinalDate, 0, { consorcioName: consorcio });

    const numOrdensSemana = await this.findNumeroDeOrdensPorIntervalo(startOfDay(dataCapturaInicialDate), endOfDay(dataCapturaFinalDate));
    // Verifica se a ultima data de captura é igual a data atual
    // E se o número de ordens é diferente.
    if (numOrdensSemana === ordens.length) {
      this.logger.log(`Já foi feita a captura de ordens de pagamento para o dia de hoje.`, METHOD);
      return;
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
          if (user) {
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
  }

  async save(ordem: BigqueryOrdemPagamentoDTO, userId: number | undefined) {
    const ordemPagamento = BigQueryToOrdemPagamento.convert(ordem, userId);
    await this.ordemPagamentoRepository.save(ordemPagamento);
  }

  async findOrdensPagamentoAgrupadasPorMes(userId: number, yearMonth: Date): Promise<OrdemPagamentoMensalDto> {
    const ordensDoMes = await this.ordemPagamentoRepository.findOrdensPagamentoAgrupadasPorMes(userId, yearMonth);
    const ordemPagamentoMensal = new OrdemPagamentoMensalDto();
    ordemPagamentoMensal.ordens = ordensDoMes.map((ordem) => {
      const o = new OrdemPagamentoAgrupadoMensalDto();
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

  async findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId: number, userId: number): Promise<OrdemPagamentoSemanalDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentoByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId, userId);
  }

  async findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId: number, userId: number, endDateParam?: Date): Promise<OrdemPagamentoSemanalDto[]> {
    return await this.ordemPagamentoRepository.findOrdensPagamentoAgrupadasByOrdemPagamentoAgrupadoId(ordemPagamentoAgrupadoId, userId, endDateParam);
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

  async findOrdensAgrupadas(dataInicio: Date, dataFim: Date, consorcios: string[]): Promise<OrdemPagamento[]> {
    return this.ordemPagamentoRepository.findOrdensAgrupadas(dataInicio, dataFim, consorcios);
  }

  async removerAgrupamentos(consorcios: string[], ids: string) {
    await this.ordemPagamentoRepository.removerAgrupamento(consorcios, ids)
  }

  public async getOrdensPendentes(dataInicio: Date, dataFim: Date, nomes: string[]) {
    return await this.ordemPagamentoRepository.findOrdensPagamentosPendentes(dataInicio, dataFim, nomes)
  }

}
