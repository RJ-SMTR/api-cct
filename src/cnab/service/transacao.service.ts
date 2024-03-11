
import { Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { asStringDate } from 'src/utils/pipe-utils';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { Transacao } from '../entity/transacao.entity';
import { PagadorContaEnum } from '../enums/pagador/pagador.enum';
import { TransacaoRepository } from '../repository/transacao.repository';
import { TransacaoDTO } from './../dto/transacao.dto';
import { ClienteFavorecidoService } from './cliente-favorecido.service';

import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { Pagador } from '../entity/pagador.entity';
import { ItemTransacaoService } from './item-transacao.service';
import { PagadorService } from './pagador.service';

@Injectable()
export class TransacaoService {
  constructor(
    private transacaoRepository: TransacaoRepository,
    private itemTransacaoService: ItemTransacaoService,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private pagadorService: PagadorService,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
  ) { }

  /**
   * This task will:
   * 1. Update ClienteFavorecidos from Users
   * 2. Fetch ordemPgto from this week
   * 3. For every id_ordem not in table, add Transacao and 
   * 
   * Assumptions:
   * 1. Every
   */
  public async updateTransacaoFromJae() {
    await this.clienteFavorecidoService.updateAllFromUsers();
    const ordensPagamento = await this.bigqueryOrdemPagamentoService.getCurrentWeekTest();
    const pagador = await this.pagadorService.getOneByConta(PagadorContaEnum.JAE);
    // WIP: idOrdemAux
    let idOrdemAux = "";

    for (const ordemPagamento of ordensPagamento) {
      if ((ordemPagamento.idOrdemPagamento as string) !== idOrdemAux) {
        const transacaoDTO = this.ordemPagamentoToTransacao(ordemPagamento, pagador.id);
        const saveTransacaoDTO = await this.transacaoRepository.save(transacaoDTO);
        const favorecido = await this.clienteFavorecidoService.getCpfCnpj(ordemPagamento.aux_favorecidoCpfCnpj);
        const itemTransacaoDTO = this.ordemPagamentoToItemTransacaoDTO(ordemPagamento,
          saveTransacaoDTO.id, favorecido.id)
        await this.itemTransacaoService.save(itemTransacaoDTO);
        idOrdemAux = ordemPagamento.idOrdemPagamento as string;
      }
    }
  }

  /**
   * Para cada BigqueryOrdemPagamento insere em Transacao
   * @returns `id_transacao` do item criado
   */
  public ordemPagamentoToTransacao(ordemPagamento: BigqueryOrdemPagamentoDTO, idPagador: number,
  ): TransacaoDTO {
    const transacao = new TransacaoDTO();
    transacao.dataOrdem = asStringDate(ordemPagamento.dataOrdem);
    transacao.dataPagamento = ((x = ordemPagamento.dataPagamento) => x ? asStringDate(x) : null)();
    transacao.nomeConsorcio = ordemPagamento.consorcio;
    transacao.nomeOperadora = ordemPagamento.operadora;
    transacao.servico = ordemPagamento.servico;
    transacao.idOrdemPagamento = Number(ordemPagamento.idOrdemPagamento);
    transacao.idOrdemRessarcimento = ordemPagamento.idOrdemRessarcimento;
    transacao.quantidadeTransacaoRateioCredito = ordemPagamento.quantidadeTransacaoRateioCredito;
    transacao.valorRateioCredito = ordemPagamento.valorRateioCredito;
    transacao.quantidadeTransacaoRateioDebito = ordemPagamento.quantidadeTransacaoRateioDebito;
    transacao.valorRateioDebito = ordemPagamento.valorRateioDebito;
    transacao.quantidadeTotalTransacao = ordemPagamento.quantidadeTotalTransacao;
    transacao.valorTotalTransacaoBruto = ordemPagamento.valorTotalTransacaoBruto;
    transacao.valorDescontoTaxa = ordemPagamento.valorDescontoTaxa;
    transacao.valorTotalTransacaoLiquido = ordemPagamento.valorTotalTransacaoLiquido;
    transacao.quantidadeTotalTransacaoCaptura = ordemPagamento.quantidadeTotalTransacaoCaptura;
    transacao.valorTotalTransacaoCaptura = ordemPagamento.valorTotalTransacaoCaptura;
    transacao.indicadorOrdemValida = ordemPagamento.indicadorOrdemValida;
    transacao.pagador = { id: idPagador } as Pagador;
    return transacao;
  }

  public ordemPagamentoToItemTransacaoDTO(ordemPagamento: BigqueryOrdemPagamentoDTO, id_transacao: number,
    idClienteFavorecido: number): ItemTransacaoDTO {
    const itemTransacao = new ItemTransacaoDTO({
      dataTransacao: asStringDate(ordemPagamento.dataOrdem),
      clienteFavorecido: { id: idClienteFavorecido },
      id: id_transacao,
    });
    return itemTransacao;
  }

  public async getAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.getAll();
  }

}