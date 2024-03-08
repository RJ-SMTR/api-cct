
import { Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamento } from 'src/bigquery/entities/ordem-pagamento.bigquery-entity';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { asBoolean, asNumber, asString, asStringDate } from 'src/utils/pipe-utils';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { Transacao } from '../entity/transacao.entity';
import { PagadorContaEnum } from '../enums/pagador/pagador.enum';
import { TransacaoRepository } from '../repository/transacao.repository';
import { TransacaoDTO } from './../dto/transacao.dto';
import { ClienteFavorecidoService } from './cliente-favorecido.service';

import { PagadorService } from './pagador.service';
import { ItemTransacaoService } from './item-transacao.service';

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
    const ordensPagamento = await this.bigqueryOrdemPagamentoService.getCurrentWeek();
    const pagador = await this.pagadorService.getOneByConta(PagadorContaEnum.JAE);
    // WIP: idOrdemAux
    let idOrdemAux = "";

    for (const ordemPagamento of ordensPagamento) {
      if ((ordemPagamento.idOrdemPagamento as string) !== idOrdemAux) {
        const transacaoDTO = this.ordemPagamentoToTransacao(ordemPagamento, pagador.id);
        const saveTransacaoDTO = await this.transacaoRepository.save(transacaoDTO);
        const favorecido = await this.clienteFavorecidoService.getCpfCnpj(ordemPagamento.idOperadora as string);
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
  public ordemPagamentoToTransacao(ordemPagamento: BigqueryOrdemPagamento, idPagador: number,
  ): TransacaoDTO {
    const transacao = new TransacaoDTO();
    transacao.dataOrdem = asStringDate(ordemPagamento.dataOrdem);
    transacao.dataPagamento = asStringDate(ordemPagamento.dataPagamento);
    transacao.nomeConsorcio = asString(ordemPagamento.consorcio);
    transacao.nomeOperadora = asString(ordemPagamento.operadora);
    transacao.servico = asString(ordemPagamento.servico);
    transacao.idOrdemRessarcimento = asString(ordemPagamento.idOrdemRessarcimento);
    transacao.quantidadeTransacaoRateioCredito = asNumber(ordemPagamento.quantidadeTransacaoRateioCredito);
    transacao.valorRateioCredito = asNumber(ordemPagamento.valorRateioCredito);
    transacao.quantidadeTransacaoRateioDebito = asNumber(ordemPagamento.quantidadeTransacaoRateioDebito);
    transacao.valorRateioDebito = asNumber(ordemPagamento.valorRateioDebito);
    transacao.quantidadeTotalTransacao = asNumber(ordemPagamento.quantidadeTotalTransacao);
    transacao.valorTotalTransacaoBruto = asNumber(ordemPagamento.valorTotalTransacaoBruto);
    transacao.valorDescontoTaxa = asNumber(ordemPagamento.valorDescontoTaxa);
    transacao.valorTotalTransacaoLiquido = asNumber(ordemPagamento.valorTotalTransacaoLiquido);
    transacao.quantidadeTotalTransacaoCaptura = asNumber(ordemPagamento.quantidadeTotalTransacaoCaptura);
    transacao.valorTotalTransacaoCaptura = asNumber(ordemPagamento.valorTotalTransacaoCaptura);
    transacao.indicadorOrdemValida = asBoolean(ordemPagamento.indicadorOrdemValida);
    transacao.pagador = { id: idPagador };
    return transacao;
  }

  public ordemPagamentoToItemTransacaoDTO(ordemPagamento: BigqueryOrdemPagamento, id_transacao: number,
    idClienteFavorecido: number): ItemTransacaoDTO {
    const itemTransacao = new ItemTransacaoDTO({
      dataCaptura: asStringDate(ordemPagamento.dataOrdem),
      dataProcessamento: asStringDate(ordemPagamento.dataPagamento),
      dataTransacao: asStringDate(ordemPagamento.dataPagamento),
      clienteFavorecido: { id: idClienteFavorecido },
      id: id_transacao,
      modo: 'WIP: incluir coluna "modo" no resultado de BigqueryOrdemPagamento',
    });
    return itemTransacao;
  }

  public async getAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.getAll();
  }

}