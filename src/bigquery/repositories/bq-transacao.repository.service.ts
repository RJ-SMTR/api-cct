import { Injectable, Logger } from '@nestjs/common';
import { BQSInstances, BigqueryService } from '../bigquery.service';
import { BqTransacao } from '../entities/transacao.bq-entity';
import { IBqFetchTransacao } from '../interfaces/bq-find-transacao-by.interface';
import { SettingsService } from 'src/settings/settings.service';
import { appSettings } from 'src/settings/app.settings';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { isCpfOrCnpj } from 'src/utils/cpf-cnpj';
import { TRIntegrationTypeMap } from 'src/ticket-revenues/maps/ticket-revenues.map';
import { BqTsansacaoTipoIntegracaoMap } from '../maps/bq-transacao-tipo-integracao.map';
import { BqTransacaoTipoTransacaoMap } from '../maps/bq-transacao-tipo-transacao.map';
import { BqTransacaoTipoPagamentoMap } from '../maps/bq-transacao-tipo-pagamento.map';

@Injectable()
export class BqTransacaoRepositoryService {
  private logger: Logger = new Logger('BqTransacaoRepositoryService', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryService: BigqueryService,
    private readonly settingsService: SettingsService,
  ) {}

  public async findTransacaoBy(
    filter?: IBqFetchTransacao,
  ): Promise<BqTransacao[]> {
    const transacoes: BqTransacao[] = (await this.fetchTransacao(filter)).data;
    return transacoes;
  }

  private async fetchTransacao(
    args?: IBqFetchTransacao,
  ): Promise<{ data: BqTransacao[]; countAll: number }> {
    const qArgs = await this.getQueryArgs(args);
    const query =
      `
      SELECT
        CAST(t.data AS STRING) AS partitionDate,
        t.hora AS processingHour,
        CAST(t.datetime_transacao AS STRING) AS datetime_transacao,
        CAST(t.datetime_processamento AS STRING) AS datetime_processamento,
        t.datetime_captura AS captureDateTime,
        t.modo AS modo,
        t.servico AS servico,
        t.sentido AS sentido,
        t.id_veiculo AS id_veiculo,
        t.id_cliente AS id_cliente,
        t.id_transacao AS id_transacao,
        t.${qArgs.tTipoPgto} AS tipo_pagamento,
        t.tipo_transacao AS tipo_transacao,
        t.id_tipo_integracao AS id_tipo_integracao,
        t.id_integracao AS id_integracao,
        t.latitude AS latitude,
        t.longitude AS longitude,
        t.stop_id AS stop_id,
        t.stop_lat AS stop_lat,
        t.stop_lon AS stop_lon,
        CASE WHEN t.tipo_transacao = 'Integração' THEN i.valor_transacao_total ELSE t.valor_transacao END AS valor_transacao,
        t.versao AS bqDataVersion,
        (${qArgs.countQuery}) AS count,
        'ok' AS status
      FROM \`${qArgs.transacao}\` t\n` +
      qArgs.joinCpfCnpj +
      '\n' +
      qArgs.joinIntegracao +
      '\n' +
      (qArgs.qWhere.length ? `WHERE ${qArgs.qWhere}\n` : '') +
      `UNION ALL
      SELECT ${'null, '.repeat(22)}
      (${qArgs.countQuery}) AS count, 'empty' AS status` +
      `\nORDER BY t.data DESC, t.hora DESC` +
      (qArgs?.limit !== undefined ? `\nLIMIT ${qArgs.limit + 1}` : '') +
      (qArgs?.offset !== undefined ? `\nOFFSET ${qArgs.offset}` : '');
    const queryResult = await this.bigqueryService.query(
      BQSInstances.smtr,
      query,
    );

    const count: number = queryResult[0].count;
    // Remove unwanted keys and remove last item (all null if empty)
    let transacoes: BqTransacao[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      return i;
    });
    transacoes.pop();
    transacoes = this.mapBqTransacao(transacoes);

    return {
      data: transacoes,
      countAll: count,
    };
  }

  private async getQueryArgs(args?: IBqFetchTransacao): Promise<{
    qWhere: string;
    bucket: string;
    transacao: string;
    integracao: string;
    tTipoPgto: string;
    joinCpfCnpj: string;
    joinIntegracao: string;
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
      transacao: IS_BQ_PROD
        ? 'rj-smtr.br_rj_riodejaneiro_bilhetagem.transacao'
        : 'rj-smtr-dev.br_rj_riodejaneiro_bilhetagem_cct.transacao',
      integracao: IS_BQ_PROD
        ? 'rj-smtr.br_rj_riodejaneiro_bilhetagem.integracao'
        : 'rj-smtr-dev.br_rj_riodejaneiro_bilhetagem_cct.integracao',
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
      queryBuilder.pushAND(
        `DATE(t.datetime_processamento) >= DATE('${startDate}')`,
      );
    }
    if (args?.endDate) {
      const endDate = args.endDate.toISOString().slice(0, 10);
      queryBuilder.pushAND(
        `DATE(t.datetime_processamento) <= DATE('${endDate}')`,
      );
    }
    if (args?.previousDays === true) {
      queryBuilder.pushAND(
        'DATE(t.datetime_processamento) > DATE(t.datetime_transacao)',
      );
    }

    queryBuilder.pushOR([]);
    if (args?.getToday) {
      const nowStr = new Date(Date.now()).toISOString().slice(0, 10);
      queryBuilder.pushAND(
        `DATE(t.datetime_processamento) = DATE('${nowStr}')`,
      );
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
    const joinIntegracao = `INNER JOIN ${Q_CONSTS.integracao} i ON i.id_transacao = t.id_transacao`;

    const countQuery =
      'SELECT COUNT(*) AS count ' +
      `FROM \`${Q_CONSTS.transacao}\` t\n` +
      joinCpfCnpj +
      '\n' +
      joinIntegracao +
      '\n' +
      (qWhere.length ? ` WHERE ${qWhere}\n` : '');
    return {
      qWhere,
      bucket: Q_CONSTS.bucket,
      transacao: Q_CONSTS.transacao,
      integracao: Q_CONSTS.integracao,
      tTipoPgto: Q_CONSTS.tTipoPgto,
      joinCpfCnpj,
      joinIntegracao,
      countQuery,
      offset,
      limit: args?.limit,
    };
  }

  /**
   * Convert id or some values into desired string values
   */
  private mapBqTransacao(transacoes: BqTransacao[]): BqTransacao[] {
    return transacoes.map((item: BqTransacao) => {
      const tipo_transacao = item.tipo_transacao;
      const tipo_pagamento = item.tipo_pagamento;
      const tipo_integracao = item.tipo_integracao;
      Object.values(TRIntegrationTypeMap[0]);
      return {
        ...item,
        paymentMediaType:
          tipo_pagamento !== null
            ? BqTransacaoTipoPagamentoMap?.[tipo_pagamento] || tipo_pagamento
            : tipo_pagamento,
        transportIntegrationType:
          tipo_integracao !== null
            ? BqTsansacaoTipoIntegracaoMap?.[tipo_integracao] || tipo_integracao
            : tipo_integracao,
        transactionType:
          tipo_transacao !== null
            ? BqTransacaoTipoTransacaoMap?.[tipo_transacao] || tipo_transacao
            : tipo_transacao,
      };
    });
  }
}