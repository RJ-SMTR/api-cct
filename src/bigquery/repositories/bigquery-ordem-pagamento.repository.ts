import { Injectable, Logger } from '@nestjs/common';
import { appSettings } from 'src/settings/app.settings';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';
import { SettingsService } from 'src/settings/settings.service';
import { isCpfOrCnpj } from 'src/utils/cpf-cnpj';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { BQSInstances, BigqueryService } from '../bigquery.service';
import { BigqueryOrdemPagamento } from '../entities/ordem-pagamento.bigquery-entity';
import { IBqFetchTransacao } from '../interfaces/bq-find-transacao-by.interface';
import { IBigqueryQueryEntity } from '../interfaces/bq-query-entity.interface';

@Injectable()
export class BigqueryOrdemPagamentoRepository {
  private logger: Logger = new Logger('BigqueryOrdemPagamentoRepository', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryService: BigqueryService,
    private readonly settingsService: SettingsService,
  ) {}

  public async findMany(
    filter?: IBigqueryQueryEntity,
  ): Promise<BigqueryOrdemPagamento[]> {
    const transacoes: BigqueryOrdemPagamento[] = (await this.queryData(filter))
      .data;
    return transacoes;
  }

  private async queryData(
    args?: IBigqueryQueryEntity,
  ): Promise<{ data: BigqueryOrdemPagamento[]; countAll: number }> {
    const qArgs = await this.getQueryArgs(args);
    const query =
      `
      SELECT
        CAST(t.data_ordem AS STRING) AS dataOrdem,
        CAST(t.data_pagamento AS STRING) AS dataPagamento,
        t.id_consorcio AS idConsorcio,
        t.consorcio AS consorcio,
        t.id_operadora AS idOperadora,
        t.operadora AS operadora,
        t.servico AS servico,
        t.id_ordem_pagamento AS idOrdemPagamento,
        t.id_ordem_ressarcimento AS idOrdemRessarcimento,
        CAST(t.quantidade_transacao_debito AS STRING) AS quantidadeTransacaoDebito,
        CAST(t.valor_debito AS STRING) AS valor_debito,
        CAST(t.quantidade_transacao_especie AS STRING) AS quantidadeTransacaoEspecie,
        CAST(t.valor_especie AS STRING) AS valorEspecie,
        CAST(t.quantidade_transacao_gratuidade AS STRING) AS quantidadeTransacaoGratuidade,
        CAST(t.valor_gratuidade AS STRING) AS valorGratuidade,
        CAST(t.quantidade_transacao_integracao AS STRING) AS quantidadeTransacaoIntegracao,
        CAST(t.valor_integracao AS STRING) AS valorIntegracao,
        CAST(t.quantidade_transacao_rateio_credito AS STRING) AS quantidadeTransacaoRateioCredito,
        CAST(t.valor_rateio_credito AS STRING) AS valorRateioCredito,
        CAST(t.quantidade_transacao_rateio_debito AS STRING) AS quantidadeTransacaoRateioDebito,
        CAST(t.valor_rateio_debito AS STRING) AS valorRateioDebito,
        CAST(t.quantidade_total_transacao AS STRING) AS quantidadeTotalTransacao,
        CAST(t.valor_total_transacao_bruto AS STRING) AS valorTotalTransacaoBruto,
        CAST(t.valor_desconto_taxa AS STRING) AS valorDescontoTaxa,
        CAST(t.valor_total_transacao_liquido AS STRING) AS valorTotalTransacaoLiquido,
        CAST(t.quantidade_total_transacao_captura AS STRING) AS quantidadeTotalTransacaoCaptura,
        CAST(t.valor_total_transacao_captura AS STRING) AS valorTotalTransacaoCaptura,
        t.indicador_ordem_valida AS indicadorOrdemValida,
        t.versao AS versao,
        -- aux columns
        (${qArgs.countQuery}) AS count,
        'ok' AS status
      FROM \`${qArgs.ordemPagamento}\` t\n` +
      qArgs.joinCpfCnpj +
      '\n' +
      (qArgs.qWhere.length ? `WHERE ${qArgs.qWhere}\n` : '') +
      `UNION ALL
      SELECT ${'null, '.repeat(29)}
      (${qArgs.countQuery}) AS count, 'empty' AS status` +
      (qArgs?.limit !== undefined ? `\nLIMIT ${qArgs.limit + 1}` : '') +
      (qArgs?.offset !== undefined ? `\nOFFSET ${qArgs.offset}` : '');
    const queryResult = await this.bigqueryService.query(
      BQSInstances.smtr,
      query,
    );

    const count: number = queryResult[0].count;
    // Remove unwanted keys and remove last item (all null if empty)
    const transacoes: BigqueryOrdemPagamento[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      return i;
    });
    transacoes.pop();
    // transacoes = this.mapBqTransacao(transacoes);

    return {
      data: transacoes,
      countAll: count,
    };
  }

  private async getQueryArgs(args?: IBqFetchTransacao): Promise<{
    qWhere: string;
    bucket: string;
    ordemPagamento: string;
    tTipoPgto: string;
    joinCpfCnpj: string;
    countQuery: string;
    offset?: number;
    limit?: number;
  }> {
    const IS_BQ_PROD =
      (
        await this.settingsService.getOneBySettingData(
          appSettings.any__bigquery_env,
          true,
        )
      ).getValueAsString() === BigqueryEnvironment.Production;
    const Q_CONSTS = {
      bucket: IS_BQ_PROD ? 'rj-smtr' : 'rj-smtr-dev',
      ordemPagamento: IS_BQ_PROD
        ? 'rj-smtr.br_rj_riodejaneiro_bilhetagem.ordem_pagamento'
        : 'rj-smtr-dev.br_rj_riodejaneiro_bilhetagem_cct.ordem_pagamento',
      tTipoPgto: IS_BQ_PROD ? 'tipo_pagamento' : 'id_tipo_pagamento',
    };
    // Args
    let offset = args?.offset;
    const queryBuilder = new QueryBuilder();
    queryBuilder.pushOR([]);
    if (args?.offset !== undefined && args.limit === undefined) {
      this.logger.warn(
        "fetchTicketRevenues(): 'offset' is defined but 'limit' is not." +
          " 'offset' will be ignored to prevent query fail",
      );
      offset = undefined;
    }

    if (args?.startDate) {
      const startDate = args.startDate.toISOString().slice(0, 10);
      queryBuilder.pushAND(`DATE(t.data_ordem) >= DATE('${startDate}')`);
    }
    if (args?.endDate) {
      const endDate = args.endDate.toISOString().slice(0, 10);
      queryBuilder.pushAND(`DATE(t.data_ordem) <= DATE('${endDate}')`);
    }
    if (args?.previousDaysOnly === true) {
      queryBuilder.pushAND('DATE(t.data_ordem) > DATE(t.datetime_transacao)');
    }

    queryBuilder.pushOR([]);
    if (args?.getToday) {
      const nowStr = new Date(Date.now()).toISOString().slice(0, 10);
      queryBuilder.pushAND(`DATE(t.data_ordem) = DATE('${nowStr}')`);
    }

    let qWhere = queryBuilder.toSQL();
    if (args?.cpfCnpj !== undefined) {
      const cpfCnpj = args.cpfCnpj;
      qWhere =
        isCpfOrCnpj(args?.cpfCnpj) === 'cpf'
          ? `b.documento = '${cpfCnpj}' AND (${qWhere})`
          : `b.cnpj = '${cpfCnpj}' AND (${qWhere})`;
    }

    // Query
    const joinCpfCnpj =
      isCpfOrCnpj(args?.cpfCnpj) === 'cpf'
        ? `LEFT JOIN \`${Q_CONSTS.bucket}.cadastro.operadoras\` b ON b.id_operadora = t.id_operadora `
        : `LEFT JOIN \`${Q_CONSTS.bucket}.cadastro.consorcios\` b ON b.id_consorcio = t.id_consorcio `;

    const countQuery =
      'SELECT COUNT(*) AS count ' +
      `FROM \`${Q_CONSTS.ordemPagamento}\` t\n` +
      joinCpfCnpj +
      '\n' +
      (qWhere.length ? ` WHERE ${qWhere}\n` : '');
    return {
      qWhere,
      bucket: Q_CONSTS.bucket,
      ordemPagamento: Q_CONSTS.ordemPagamento,
      tTipoPgto: Q_CONSTS.tTipoPgto,
      joinCpfCnpj,
      countQuery,
      offset,
      limit: args?.limit,
    };
  }
}
