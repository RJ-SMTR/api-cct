import { TransacaoDTO } from './../dto/transacao.dto';
import { Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamento } from 'src/bigquery/entities/ordem-pagamento.bigquery-entity';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { PagadorContaEnum } from '../enums/pagador/pagador.enum';
import { TransacaoRepository } from '../repository/transacao.repository';
import { ClienteFavorecidoService } from './cliente-favorecido.service';
import { PagadorService } from './pagador.service';
import { ItemTransacaoService } from './item-transacao.service';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { stringToDate } from 'src/utils/date-utils';
// import { TransacaoClienteItemService } from './transacao-cliente-item.service';

@Injectable()
export class TransacaoService {
  constructor(
    private transacaoRepository: TransacaoRepository,
    private itemTransacaoService: ItemTransacaoService,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private pagadorService: PagadorService,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
  ) {}
  public async insereTransacoes() {
    //Atualiza todos os favorecidos
    await this.clienteFavorecidoService.updateAllFromUsers();
    
    const ordensPagamento = await this.bigqueryOrdemPagamentoService.getCurrentWeek();

    const pagador = await this.pagadorService.getOneByConta(PagadorContaEnum.JAE);
    var idOrdemAux:string="";

    ordensPagamento.forEach(async ordemPagamento => {
      var saveTransacaoDTO;
      if((ordemPagamento.id_ordem_pagamento as string)!==idOrdemAux){
        var transacaoDTO = await this.ordemPagamentoToTransacao(ordemPagamento, pagador.id_pagador);
        saveTransacaoDTO = await this.transacaoRepository.save(transacaoDTO);
      }
      var favorecido = await this.clienteFavorecidoService.findCpfCnpj(ordemPagamento.id_operadora as string);
      var itemTransacao = await this.ordemPagamentoToItemTransacao(ordemPagamento,
        saveTransacaoDTO.id_transacao,favorecido.id_cliente_favorecido)  
      this.itemTransacaoService.save(itemTransacao);
      idOrdemAux = ordemPagamento.id_ordem_pagamento as string;
    });
  }

  /**
   * Para cada BigqueryOrdemPagamento insere em Transacao
   * @returns `id_transacao` do item criado
   */
  public async ordemPagamentoToTransacao(ordemPagamento: BigqueryOrdemPagamento,id_pagador: number,
  ): Promise<TransacaoDTO> {    
      var transacao = new TransacaoDTO();    
      transacao.dt_ordem= ordemPagamento.data_ordem as string,
      transacao.dt_pagamento= ordemPagamento.data_pagamento as string,
      transacao.nome_consorcio= ordemPagamento.consorcio as string,
      transacao.nome_operadora= ordemPagamento.operadora as string,
      transacao.servico= ordemPagamento.servico as string,
      transacao.id_ordem_ressarcimento= ordemPagamento.id_ordem_ressarcimento as string,
      transacao.qtde_transacao_rateio_credito = ordemPagamento.quantidade_transacao_rateio_credito as number,
      transacao.vlr_rateio_credito= ordemPagamento.valor_rateio_credito as number,
      transacao.qtde_transacao_rateio_debito= ordemPagamento.valor_rateio_debito as number,
      transacao.vlr_rateio_debito= ordemPagamento.valor_rateio_debito as number,
      transacao.quantidade_total_transacao= ordemPagamento.quantidade_total_transacao as number,
      transacao.vlr_total_transacao_bruto= ordemPagamento.valor_total_transacao_bruto as number,
      transacao.vlr_desconto_taxa= ordemPagamento.valor_desconto_taxa as number,
      transacao.vlr_total_transacao_liquido= ordemPagamento.valor_total_transacao_liquido as number,
      transacao.qtde_total_transacao_captura= ordemPagamento.quantidade_total_transacao_captura as number,
      transacao.vlr_total_transacao_captura= ordemPagamento.valor_total_transacao_captura as number,
      transacao.indicador_ordem_valida= String(ordemPagamento.indicador_ordem_valida)
      transacao.id_pagador = id_pagador;
    return transacao;
  }

  public async ordemPagamentoToItemTransacao(ordemPagamento: BigqueryOrdemPagamento,id_transacao:number,
    id_cliente_favorecido: number): Promise<ItemTransacaoDTO> { 
      var itemTransacao = new ItemTransacaoDTO();    
      itemTransacao.dt_captura = stringToDate(ordemPagamento.data_ordem as string);
      itemTransacao.dt_processamento = stringToDate(ordemPagamento.data_pagamento as string);
      itemTransacao.dt_transacao = stringToDate(ordemPagamento.data_pagamento as string);
      itemTransacao.id_tipo_pagamento = parseInt(ordemPagamento.id_ordem_pagamento as string);
      itemTransacao.id_transacao = id_transacao;
      itemTransacao.modo = "";
      itemTransacao.nome_consorcio = ordemPagamento.consorcio as string;
      itemTransacao.tipo_transacao = ordemPagamento.servico as string;
      itemTransacao.valor_item_transacao = ordemPagamento.valor_total_transacao_liquido as number;
      itemTransacao.id_cliente_favorecido = id_cliente_favorecido;
      return itemTransacao;
  }

}

