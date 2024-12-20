import { HttpException, Injectable, OnModuleInit } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { AllPagadorDict } from 'src/cnab/interfaces/pagamento/all-pagador-dict.interface';
import { PagadorService } from 'src/cnab/service/pagamento/pagador.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { OnModuleLoad } from 'src/utils/interfaces/on-load.interface';
import { Nullable } from 'src/utils/types/nullable.type';
import { Between } from 'typeorm';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { OrdemPagamentoAgrupadoRepository } from '../repository/ordem-pagamento-agrupado.repository';
import { OrdemPagamentoRepository } from '../repository/ordem-pagamento.repository';

@Injectable()
export class OrdemPagamentoService implements OnModuleInit, OnModuleLoad {
  private logger = new CustomLogger(OrdemPagamentoService.name, { timestamp: true });

  constructor(
    private ordemPamentoRepository: OrdemPagamentoRepository, //
    private ordemPamentoAgrupadoRepository: OrdemPagamentoAgrupadoRepository,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
    private pagadorService: PagadorService,
    private usersService: UsersService,
  ) {}

  onModuleInit() {
    this.onModuleLoad().catch((error: Error) => {
      throw error;
    });
  }

  async onModuleLoad(): Promise<any> {
    await this.sincronizarOrdensPagamento(new Date('2024-11-15'), new Date('2024-11-21'), 'TEC');
  }

  async sincronizarOrdensPagamento(dataCapturaInicialDate: Date, dataCapturaFinalDate: Date, consorcio: string) {
    const METHOD = 'sincronizarOrdensPagamento';
    const ordens = await this.bigqueryOrdemPagamentoService.getFromWeek(dataCapturaInicialDate, dataCapturaFinalDate, 0, { consorcioName: [consorcio] });
    this.logger.debug(`Iniciando sincronismo de ${ordens.length} ordens`, METHOD);

    for (const ordem of ordens) {
      if (ordem.operadoraCpfCnpj) {
        let user: User | undefined;
        try {
          user = await this.usersService.getOne({ cpfCnpj: ordem.operadoraCpfCnpj });
          if (user) {
            await this.inserirOrdemPagamento(ordem, user.id);
          }
        } catch (error) {
          /***  TODO: Caso o erro lançado seja relacionado ao fato do usuário não ter sido encontrado,
              ajustar o código para inserir a ordem de pagamento com o usuário nulo
           ***/
          if (error instanceof HttpException && !user) {
            // await this.inserirOrdemPagamento(ordem, null);
          }
          this.logger.error(`Erro ao sincronizar ordem de pagamento ${ordem.id}: ${error.message}`, METHOD);
        }
      }
    }
    this.logger.debug(`Sincronizado ${ordens.length} ordens`, METHOD);
  }

  async prepararPagamentoAgrupados(dataOrdemInicial: Date, dataOrdemFinal: Date, pagadorKey: keyof AllPagadorDict) {
    const ordens = await this.ordemPamentoRepository.findAll({ dataOrdem: Between(dataOrdemInicial, dataOrdemFinal) });
    const contaPagadora = await this.getPagador(pagadorKey);
    const ordemPagamentoAgrupada = await this.inserirOrdemPagamentoAgrupado(ordens);
  }

  async getPagador(pagadorKey: any) {
    return (await this.pagadorService.getAllPagador())[pagadorKey];
  }

  async getFavorecido(operadoraCpfCnpj: string): Promise<Nullable<User>> {
    return await this.usersService.findOne({ cpfCnpj: operadoraCpfCnpj });
  }

  async inserirOrdemPagamento(ordem: BigqueryOrdemPagamentoDTO, userId: number) {
    const ordemPagamento = await this.convertOrdemPagamento(ordem, userId);
    await this.ordemPamentoRepository.save(ordemPagamento);
  }

  async inserirOrdemPagamentoAgrupado(ordens: OrdemPagamento[]) {
    for (const ordem of ordens) {
      let ordemPagamentoAgrupado = await this.ordemPamentoAgrupadoRepository.findOne({ ordensPagamento: [{ id: ordem.id }] });
      if (!ordemPagamentoAgrupado) {
        ordemPagamentoAgrupado = new OrdemPagamentoAgrupado();
      }

      ordemPagamentoAgrupado.valorTotal = ordem.valor || 0;
      await this.ordemPamentoAgrupadoRepository.save(ordemPagamentoAgrupado);
    }
  }

  async convertOrdemPagamento(ordem: BigqueryOrdemPagamentoDTO, userId: number): Promise<OrdemPagamento> {
    var result = new OrdemPagamento();
    result.id = ordem.id;
    result.dataOrdem = new Date(ordem.dataOrdem);
    result.idConsorcio = ordem.idConsorcio;
    result.consorcioCnpj = ordem.consorcioCnpj;
    result.idOperadora = ordem.idOperadora;
    result.operadoraCpfCnpj = ordem.operadoraCpfCnpj;
    result.idOrdemPagamento = ordem.idOrdemPagamento;
    result.nomeConsorcio = ordem.consorcio;
    result.nomeOperadora = ordem.operadora;
    result.userId = userId;
    result.valor = ordem.valorTotalTransacaoLiquido;
    result.bqUpdatedAt = new Date(ordem.datetimeUltimaAtualizacao);
    result.dataCaptura = ordem.dataCaptura;
    return result;
  }
}
