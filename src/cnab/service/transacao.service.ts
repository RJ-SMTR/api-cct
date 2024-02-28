// import { BigqueryTransacaoService } from 'src/bigquery/services/bigquery-transacao.service';
// import { ClienteFavorecidoService } from './cliente-favorecido.service';
// import { Injectable } from '@nestjs/common';
// import { TransacaoRepository } from '../repository/transacao.repository';
// import { CreateTransacaoDto } from '../interfaces/transacao/create-transacao.dto';
// import { Transacao } from '../entity/transacao.entity';
// import { BigqueryTransacao } from 'src/bigquery/entities/transacao.bigquery-entity';
// import { Pagador } from '../entity/pagador.entity';
// import { PagadorService } from './pagador.service';
// import { PagadorContaEnum as PagadorContaEnum } from '../enums/pagador/pagador.enum';
// import { nextFriday, parse } from 'date-fns';

// @Injectable()
export class TransacaoService {
  // constructor(
  //    private transacaoRepository: TransacaoRepository,
  //    private transacaoClienteItemService: TransacaoClienteItemService,
  //    private clienteFavorecidoService: ClienteFavorecidoService,
  //    private pagadorService: PagadorService,
  //    private bigqueryTransacaoService: BigqueryTransacaoService,
  // ) { }
  // public async insereTransacoes() {
  //    const favorecidos = await this.clienteFavorecidoService.updateAllFromUsers();
  //    const transacoesJae = await this.bigqueryTransacaoService.getTransacaoOfCurrentWeek();
  //    for (const bigqueryTransacao of transacoesJae) {
  //       //metodo de consultar o pagador
  //       const pagador = await this.pagadorService.getOneById(PagadorContaEnum.JAE);
  //       var id_transacao = await this.insertTransacao(bigqueryTransacao, pagador);
  //       //buscar todas as ordens de pagamento por idTransacaoFernanda
  //       var ordensPgto = buscarOrder(bigqueryTransacao.id_transacao);
  //       for (const ordemPgto of ordensPgto) {
  //          var id_cliente_favorecido = listaCliente.findByCPFCNPJ(ordemPgto.cpf_enpj);
  //          itemTransacao.id_cliente_favorecido = id_cliente_favorecido;
  //          //insere o item detalhamento
  //          itemTransacao.id_transacao = id_transacao;
  //          itemTransacao.idClientFavorecido = idClienteFavorecido;
  //          itemTransacao.dt_transacao = ordemPgto.dt_transacao;
  //          itemTransacaoRepository.insere(itemTransacao);
  //       }
  //    }
  // }
  // public async insertTransacao(
  //    bigqueryTransacao: BigqueryTransacao,
  //    id_pagador: number,
  // ): Promise<number> {
  //    return await this.transacaoRepository.create({
  //       dt_ordem: nextFriday(new Date(bigqueryTransacao.datetime_processamento)),
  //       dt_pagamento: '',
  //       nome_consorcio: bigqueryTransacao.consorcio,
  //       nome_operadora: bigqueryTransacao.operadora,
  //       servico: bigqueryTransacao.servico,
  //       id_ordem_ressarcimento: -1,
  //       qtde_transacao_rateio_credito: number
  //          vlr_rateio_credito: number
  //          qtde_transacao_rateio_debito: number
  //          vlr_rateio_debito: number
  //          quantidade_total_transacao: number
  //          vlr_total_transacao_bruto: number
  //          vlr_desconto_taxa: number
  //          vlr_total_transacao_liquido: number
  //          qtde_total_transacao_captura: number
  //          vlr_total_transacao_captura: number
  //          indicador_ordem_valida: string
  //    });
  // }
}
