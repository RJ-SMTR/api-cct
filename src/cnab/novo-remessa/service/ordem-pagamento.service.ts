import { Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';
import { BigQueryToOrdemPagamento } from '../convertTo/bigquery-to-ordem-pagamento.convert';

@Injectable()
export class OrdemPagamentoService {
  private logger = new CustomLogger(OrdemPagamentoService.name, { timestamp: true });

  constructor(
    private ordemPagamentoRepository: OrdemPagamentoRepository, 
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
    private usersService: UsersService,
  ) {}   

  async sincronizarOrdensPagamento(dataOrdemInicialDate: Date, dataOrdemFinalDate: Date, consorcio: string) {
    const METHOD = 'sincronizarOrdensPagamento';
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataOrdemInicialDate, dataOrdemFinalDate, 0, { consorcioName: [consorcio] });
    this.logger.debug(`Iniciando sincronismo de ${ordens.length} ordens`, METHOD);

    for (const ordem of ordens) {
      if (ordem.operadoraCpfCnpj) {
        const user = await this.usersService.getOne({ cpfCnpj: ordem.operadoraCpfCnpj });
        if (user) {
          this.logger.debug(`Salvando a ordem: ${ordem.idOrdemPagamento} para usuario: ${user.fullName}`, METHOD);
          await this.save(ordem, user.id);
        }
      }
    }
    this.logger.debug(`Sincronizado ${ordens.length} ordens`, METHOD);
  } 

  async save(ordem: BigqueryOrdemPagamentoDTO, userId: number) {
    const ordemPagamento = BigQueryToOrdemPagamento.convert(ordem, userId);
    await this.ordemPagamentoRepository.save(ordemPagamento);
  } 
}