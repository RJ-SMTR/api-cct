
import { Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamento } from 'src/bigquery/entities/ordem-pagamento.bigquery-entity';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { Transacao } from '../entity/transacao.entity';
import { PagadorContaEnum } from '../enums/pagador/pagador.enum';
import { TransacaoRepository } from '../repository/transacao.repository';
import { TransacaoDTO } from './../dto/transacao.dto';
import { ClienteFavorecidoService } from './cliente-favorecido.service';
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
  public async insereTransacoes() {
    //Atualiza todos os favorecidos
    await this.clienteFavorecidoService.updateAllFromUsers();

    const ordensPagamento = await this.bigqueryOrdemPagamentoService.getCurrentWeek();

    const pagador = await this.pagadorService.getOneByConta(PagadorContaEnum.JAE);
    let idOrdemAux = "";

    for (const ordemPagamento of ordensPagamento) {
      if ((ordemPagamento.id_ordem_pagamento as string) !== idOrdemAux) {
        const transacaoDTO = this.ordemPagamentoToTransacao(ordemPagamento, pagador.id_pagador);
        const saveTransacaoDTO = await this.transacaoRepository.save(transacaoDTO);
        const favorecido = await this.clienteFavorecidoService.getCpfCnpj(ordemPagamento.id_operadora as string);
        const itemTransacaoDTO = this.ordemPagamentoToItemTransacaoDTO(ordemPagamento,
          saveTransacaoDTO.id_transacao, favorecido.id_cliente_favorecido)
        await this.itemTransacaoService.save(itemTransacaoDTO);
        idOrdemAux = ordemPagamento.id_ordem_pagamento as string;
      }
    }
  }

  /**
   * Para cada BigqueryOrdemPagamento insere em Transacao
   * @returns `id_transacao` do item criado
   */
  public ordemPagamentoToTransacao(ordemPagamento: BigqueryOrdemPagamento, id_pagador: number,
  ): TransacaoDTO {
    const transacao = new TransacaoDTO();
    transacao.dt_ordem = new Date(ordemPagamento.getDataOrdem());
    transacao.dt_pagamento = new Date(ordemPagamento.getDataPagamento());
    transacao.nome_consorcio = ordemPagamento.getConsorcio();
    transacao.nome_operadora = ordemPagamento.getOperadora();
    transacao.servico = ordemPagamento.getServico();
    transacao.id_ordem_ressarcimento = ordemPagamento.getIdOrdemRessarcimento();
    transacao.qtde_transacao_rateio_credito = ordemPagamento.getQuantidadeTransacaoRateioCredito();
    transacao.vlr_rateio_credito = ordemPagamento.getValorRateioCredito();
    transacao.qtde_transacao_rateio_debito = ordemPagamento.getValorRateioDebito();
    transacao.vlr_rateio_debito = ordemPagamento.getValorRateioDebito();
    transacao.quantidade_total_transacao = ordemPagamento.getQuantidadeTotalTransacao();
    transacao.vlr_total_transacao_bruto = ordemPagamento.getValorTotalTransacaoBruto();
    transacao.vlr_desconto_taxa = ordemPagamento.getValorDescontoTaxa();
    transacao.vlr_total_transacao_liquido = ordemPagamento.getValorTotalTransacaoLiquido();
    transacao.qtde_total_transacao_captura = ordemPagamento.getQuantidadeTotalTransacaoCaptura();
    transacao.vlr_total_transacao_captura = ordemPagamento.getValorTotalTransacaoCaptura();
    transacao.indicador_ordem_valida = ordemPagamento.getIndicadorOrdemValida();
    transacao.id_pagador = id_pagador;
    return transacao;
  }

  public ordemPagamentoToItemTransacaoDTO(ordemPagamento: BigqueryOrdemPagamento, id_transacao: number,
    id_cliente_favorecido: number): ItemTransacaoDTO {
    const itemTransacao = new ItemTransacaoDTO({
      dt_captura: new Date(ordemPagamento.getDataOrdem()),
      dt_processamento: new Date(ordemPagamento.getDataPagamento()),
      dt_transacao: new Date(ordemPagamento.getDataPagamento()),
      id_cliente_favorecido: id_cliente_favorecido,
      id_item_transacao: id_transacao,
      modo: 'WIP: incluir coluna "modo" no resultado de BigqueryOrdemPagamento',
    });
    return itemTransacao;
  }

  public async getAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.getAll();
  }

}