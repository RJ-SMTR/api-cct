import { Injectable } from '@nestjs/common';
import { CustomLogger } from 'src/utils/custom-logger';
import { bigToNumber } from 'src/utils/pipe-utils';
import { BigqueryService, BigquerySource } from '../bigquery.service';
import { BigqueryOrdemPagamento } from '../entities/ordem-pagamento.bigquery-entity';
import { IBigqueryFindOrdemPagamento } from '../interfaces/bigquery-find-ordem-pagamento.interface';

@Injectable()
export class BigqueryOrdemPagamentoRepository {
  private logger = new CustomLogger('BigqueryOrdemPagamentoRepository', { timestamp: true });

  constructor(
    private readonly bigqueryService: BigqueryService,
  ) {}

  public async findMany(
    filter: IBigqueryFindOrdemPagamento,
  ): Promise<BigqueryOrdemPagamento[]> {
    const transacoes: BigqueryOrdemPagamento[] = (await this.queryData(filter))
      .data;
    return transacoes;
  }

  public async query(
    sql: string,
  ): Promise<{ data: BigqueryOrdemPagamento[]; countAll: number }> {
    // TODO: remover tipoFavorecido
    const queryResult = await this.bigqueryService.query(
      BigquerySource.smtr,
      sql,
    );
    const count: number = queryResult.length;
    // Remove unwanted keys and remove last item (all null if empty)
    const items: BigqueryOrdemPagamento[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      return i;
    });

    return {
      data: items,
      countAll: count,
    };
  }

  private async queryData(
    args: IBigqueryFindOrdemPagamento,
  ): Promise<{ data: BigqueryOrdemPagamento[]; countAll: number }> {
    // TODO: remover tipoFavorecido
    const query = this.getQuery(args);
    const queryResult = await this.bigqueryService.query(
      BigquerySource.smtr,
      query,
    );
    const count: number = queryResult.length;
    // Remove unwanted keys and remove last item (all null if empty)
    const items: BigqueryOrdemPagamento[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      i.valorDebito = bigToNumber(i.valorDebito);
      i.valorDescontoTaxa = bigToNumber(i.valorDescontoTaxa);
      i.valorEspecie = bigToNumber(i.valorEspecie);
      i.valorGratuidade = bigToNumber(i.valorGratuidade);
      i.valorIntegracao = bigToNumber(i.valorIntegracao);
      i.valorRateioCredito = bigToNumber(i.valorRateioCredito);
      i.valorRateioDebito = bigToNumber(i.valorRateioDebito);
      i.valorTotalTransacaoBruto = bigToNumber(i.valorTotalTransacaoBruto);
      i.valorTotalTransacaoLiquido = bigToNumber(i.valorTotalTransacaoLiquido);
      return i;
    });

    return {
      data: items,
      countAll: count,
    };
  }

  /**
   * Regra de negócio:
   * - 13/06/2024: STPL é considerado STPC também
   */
  private getQuery(args: IBigqueryFindOrdemPagamento) {
    const qArgsConsorcio = this.getQueryArgsConsorcio(args);
    const qArgsOperadora = this.getQueryArgsOperadora(args);
    const select = `
      SELECT
        CAST(t.data_ordem AS STRING) AS dataOrdem,
        CAST(t.data_pagamento AS STRING) AS dataPagamento,
        t.id_ordem_pagamento_consorcio_operador_dia AS id,
        t.id_consorcio AS idConsorcio,
        t.consorcio,
        t.id_operadora AS idOperadora,
        o.operadora_completo AS operadora,
        t.id_ordem_pagamento AS idOrdemPagamento,
        t.quantidade_transacao_debito AS quantidadeTransacaoDebito,
        t.valor_debito AS valorDebito,
        t.quantidade_transacao_especie AS quantidadeTransacaoEspecie,
        t.valor_especie AS valorEspecie,
        t.quantidade_transacao_gratuidade AS quantidadeTransacaoGratuidade,
        t.valor_gratuidade AS valorGratuidade,
        t.quantidade_transacao_integracao AS quantidadeTransacaoIntegracao,
        t.valor_integracao AS valorIntegracao,
        t.quantidade_transacao_rateio_credito AS quantidadeTransacaoRateioCredito,
        t.valor_rateio_credito AS valorRateioCredito,
        t.quantidade_transacao_rateio_debito AS quantidadeTransacaoRateioDebito,
        t.valor_rateio_debito AS valorRateioDebito,
        t.valor_total_transacao_bruto AS valorTotalTransacaoBruto,
        t.valor_desconto_taxa AS valorDescontoTaxa,
        t.valor_total_transacao_liquido AS valorTotalTransacaoLiquido,
        t.versao AS versao,
        o.tipo_documento AS operadoraTipoDocumento,
        CAST(c.cnpj AS STRING) AS consorcioCnpj,
        CAST(o.documento AS STRING) AS operadoraCpfCnpj,
        CAST(datetime_ultima_atualizacao AS STRING) AS datetimeUltimaAtualizacao,
        CAST(t.datetime_captura AS STRING) dataCaptura
      FROM \`rj-smtr.br_rj_riodejaneiro_bilhetagem.ordem_pagamento_consorcio_operador_dia\` t
      LEFT JOIN \`rj-smtr.cadastro.operadoras\` o ON o.id_operadora = t.id_operadora 
      LEFT JOIN \`rj-smtr.cadastro.consorcios\` c ON c.id_consorcio = t.id_consorcio \n
    `;
    /**
     * Pesquisar separadamente apenas por consórcio e apenas por operadoras.
     * Assim evita misturar os resultados e dar problema no pagamento.
     */
    const query =
      select +
      `WHERE ${qArgsConsorcio}\n` +
      'UNION ALL\n' +
      select +
      `WHERE ${qArgsOperadora}\n` +
      '\nORDER BY dataOrdem ASC, idConsorcio ASC\n';
    return query;
  }

  /**
   * Ao buscar por consórcios, ignorar o STPC.
   * 
   * STPC apensar de ser tecnicamente um consórcio, ele não é tratado como um.
   * Pois ele representa todos os operadores.
   */
  private getQueryArgsConsorcio(args: IBigqueryFindOrdemPagamento) {
    const startDate = args.startDate.toISOString().slice(0, 10);
    const endDate = args.endDate.toISOString().slice(0, 10);
    let qWhere =
      `date(t.datetime_captura) BETWEEN '${startDate}' AND '${endDate}' AND o.tipo_documento = 'CNPJ' ` +
      'AND t.valor_total_transacao_liquido > 0 AND c.consorcio <> \'STPC\'';
    if (args.consorcioName?.length) {
      qWhere += ` AND c.consorcio IN ('${args.consorcioName.join("', '")}')`
    }
    return qWhere;
  }

  private getQueryArgsOperadora(args: IBigqueryFindOrdemPagamento) {
    const startDate = args.startDate.toISOString().slice(0, 10);
    const endDate = args.endDate.toISOString().slice(0, 10);
    let qWhere =
      `date(t.datetime_captura) BETWEEN '${startDate}' AND '${endDate}' AND o.tipo_documento = 'CPF' ` +
      'AND t.valor_total_transacao_liquido > 0';
    if (args.consorcioName?.length) {
      qWhere += ` AND c.consorcio IN ('${args.consorcioName.join("', '")}')`;
    }
    return qWhere;
  }
}
