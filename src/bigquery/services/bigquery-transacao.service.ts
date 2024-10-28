import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/utils/custom-logger';
import { BigqueryTransacao } from '../entities/transacao.bigquery-entity';
import { BigqueryTransacaoRepository, IBqFindTransacao } from '../repositories/bigquery-transacao.repository';

@Injectable()
export class BigqueryTransacaoService {
  private logger = new CustomLogger('BigqueryOrdemPagamentoService', { timestamp: true });

  constructor(private readonly bigqueryTransacaoRepository: BigqueryTransacaoRepository) {}

  /**
   * Obter dados da semana de pagamento (qui-qua).
   *
   * @param [daysBack=0] Pega a semana atual ou N dias atrás.
   */
  public async getFromWeek(dataOrdemInicial: Date, dataOrdemFinal: Date, daysBack = 0, filter?: IBqFindTransacao): Promise<BigqueryTransacao[]> {
    const transacao = (
      await this.bigqueryTransacaoRepository.findMany({
        startDate: dataOrdemInicial,
        endDate: dataOrdemFinal,
        ...(filter ? filter : {}),
      })
    ).map((i) => ({ ...i } as BigqueryTransacao));
    return transacao;
  }

  public async findMany(filter?: IBqFindTransacao) {
    const transacaoBq = await this.bigqueryTransacaoRepository.findMany(filter);
    const transacaoView = transacaoBq.map((i) => i as BigqueryTransacao);
    return transacaoView;
  }

  public async findManyPaginated(filter: IBqFindTransacao, limit: number, callback: (items: BigqueryTransacao[]) => void) {
    let page = 1;
    let offset = limit * page;
    let transacoesBq = await this.bigqueryTransacaoRepository.findMany({ ...filter, limit, offset });
    while (transacoesBq.length) {
      callback(transacoesBq);
      page += 1;
      offset = limit * page;
      transacoesBq = await this.bigqueryTransacaoRepository.findMany({ ...filter, limit, offset });
    }
  }

  /**
   * Get data from current payment week (qui-qua). Also with older days.
   */
  public async getAll(): Promise<BigqueryTransacao[]> {
    // Read
    const ordemPgto = (await this.bigqueryTransacaoRepository.findMany()).map((i) => ({ ...i } as BigqueryTransacao));
    return ordemPgto;
  }

  /**
   * A cada 10 dias, de hoje até a dataInicio, pesquisa e chama o callback
   */
  public async getAllPaginated(callback: (transacoes: BigqueryTransacao[]) => void, cpfCnpjs: string[] = []) {
    const transacoes: BigqueryTransacao[] = await this.bigqueryTransacaoRepository.findMany({
      manyCpfCnpj: cpfCnpjs,
    });
    callback(transacoes);
  }
}
