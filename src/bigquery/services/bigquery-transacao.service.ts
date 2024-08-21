import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/utils/custom-logger';
import { BigqueryTransacao } from '../entities/transacao.bigquery-entity';
import { BigqueryTransacaoRepository } from '../repositories/bigquery-transacao.repository';

@Injectable()
export class BigqueryTransacaoService {
  private logger = new CustomLogger('BigqueryOrdemPagamentoService', { timestamp: true });

  constructor(private readonly bigqueryTransacaoRepository: BigqueryTransacaoRepository) {}

  /**
   * Obter dados da semana de pagamento (qui-qua).
   *
   * @param [daysBack=0] Pega a semana atual ou N dias atrás.
   */
  public async getFromWeek(dataOrdemInicial: Date, dataOrdemFinal: Date, daysBack = 0): Promise<BigqueryTransacao[]> {
    const transacao = (
      await this.bigqueryTransacaoRepository.findMany({
        startDate: dataOrdemInicial,
        endDate: dataOrdemFinal,
      })
    ).map((i) => ({ ...i } as BigqueryTransacao));
    return transacao;
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
