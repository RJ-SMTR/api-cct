import { Injectable } from '@nestjs/common';
import { BigqueryOrdemPagamento } from 'src/bigquery/entities/ordem-pagamento.bigquery-entity';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { PagadorContaEnum } from '../enums/pagador/pagador.enum';
import { TransacaoRepository } from '../repository/transacao.repository';
import { ClienteFavorecidoService } from './cliente-favorecido.service';
import { PagadorService } from './pagador.service';
import { Transacao } from '../entity/transacao.entity';
// import { TransacaoClienteItemService } from './transacao-cliente-item.service';

@Injectable()
export class TransacaoService {
  constructor(
    private transacaoRepository: TransacaoRepository,
    // private transacaoClienteItemService: TransacaoClienteItemService,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private pagadorService: PagadorService,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
  ) {}
  public async insereTransacoes() {
    await this.clienteFavorecidoService.updateAllFromUsers();
    const favorecidos = await this.clienteFavorecidoService.getAll();
    console.log(favorecidos);
    const bqOrdensWeek =
      await this.bigqueryOrdemPagamentoService.getCurrentWeek();
    const pagador = await this.pagadorService.getOneByConta(
      PagadorContaEnum.JAE,
    );
    // FIXME: Cada dia tem 1 id_ordem. Cada id_ordem tem N cpf e N cnpj.
    // Onde 1 CPF pode ter N cnpj e vice-versa.
    // Se 1 transação estiver relacionado a usuário cpf e 1 usuário cnpj, então 2 usuários
    // seriam destinatários da mesma transação, o que não faz sentido.
    // Por ora podemos assumir que: se tiver 2 usuários, retornar erro com esse motivo.
    for (const bqOrdem of bqOrdensWeek) {
      const id_transacao = await this.insertTransacao(
        bqOrdem,
        pagador.id_pagador,
      );
      console.log(id_transacao);
      // var id_cliente_favorecido = listaCliente.findByCPFCNPJ(ordemPgto.cpf_enpj);
      // itemTransacao.id_cliente_favorecido = id_cliente_favorecido;
      // itemTransacao.id_transacao = id_transacao;
      // itemTransacao.idClientFavorecido = idClienteFavorecido;
      // itemTransacao.dt_transacao = ordemPgto.dt_transacao;
      // itemTransacaoRepository.insere(itemTransacao);
    }
  }

  /**
   * Para cada BigqueryOrdemPagamento insere em Transacao
   * @returns `id_transacao` do item criado
   */
  public async insertTransacao(
    bqOrdemPagamento: BigqueryOrdemPagamento,
    id_pagador: number,
  ): Promise<number> {
    console.log(id_pagador);
    return await this.transacaoRepository.save({
      dt_ordem: bqOrdemPagamento.data_ordem as string,
      dt_pagamento: bqOrdemPagamento.data_pagamento as string,
      nome_consorcio: bqOrdemPagamento.consorcio as string,
      nome_operadora: bqOrdemPagamento.operadora as string,
      servico: bqOrdemPagamento.servico as string,
      id_ordem_ressarcimento: bqOrdemPagamento.id_ordem_ressarcimento as string,
      qtde_transacao_rateio_credito:
        bqOrdemPagamento.quantidade_transacao_rateio_credito as number,
      vlr_rateio_credito: bqOrdemPagamento.valor_rateio_credito as number,
      qtde_transacao_rateio_debito:
        bqOrdemPagamento.valor_rateio_debito as number,
      vlr_rateio_debito: bqOrdemPagamento.valor_rateio_debito as number,
      quantidade_total_transacao:
        bqOrdemPagamento.quantidade_total_transacao as number,
      vlr_total_transacao_bruto:
        bqOrdemPagamento.valor_total_transacao_bruto as number,
      vlr_desconto_taxa: bqOrdemPagamento.valor_desconto_taxa as number,
      vlr_total_transacao_liquido:
        bqOrdemPagamento.valor_total_transacao_liquido as number,
      qtde_total_transacao_captura:
        bqOrdemPagamento.quantidade_total_transacao_captura as number,
      vlr_total_transacao_captura:
        bqOrdemPagamento.valor_total_transacao_captura as number,
      indicador_ordem_valida: String(bqOrdemPagamento.indicador_ordem_valida),
    });
  }

  public async getAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.getAll();
  }
}
