import { Injectable, Logger } from '@nestjs/common';
import { endOfDay, isToday, startOfDay } from 'date-fns';
import { BQSInstances, BigqueryService } from 'src/bigquery/bigquery.service';
import { isCpfOrCnpj } from 'src/utils/cpf-cnpj';
import { getPagination } from 'src/utils/get-pagination';
import { getPaymentDates } from 'src/utils/payment-date-utils';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { ITicketRevenue } from './interfaces/ticket-revenue.interface';
import { ITicketRevenuesGroup } from './interfaces/ticket-revenues-group.interface';
import { ITRGetMeIndividualValidArgs } from './interfaces/tr-get-me-individual-args.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';
import {
  TRIntegrationTypeMap,
  TRPaymentTypeMap,
  TRTransactionTypeMap,
} from './maps/ticket-revenues.map';
import { SettingsService } from 'src/settings/settings.service';
import { appSettings } from 'src/settings/app.settings';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';

@Injectable()
export class TicketRevenuesRepositoryService {
  private logger: Logger = new Logger('TicketRevenuesService', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryService: BigqueryService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * TODO: use it only for repository services
   *
   * Filter: used by:
   * - ticket-revenues/get/me
   */
  removeTodayData<T extends ITicketRevenue | ITicketRevenuesGroup>(
    data: T[],
    endDate: Date,
  ): T[] {
    const mostRecentDate = startOfDay(new Date(data[0].partitionDate));
    if (mostRecentDate > endOfDay(endDate)) {
      return data.filter((i) => !isToday(new Date(i.partitionDate)));
    } else {
      return data;
    }
  }

  /**
   * TODO: use it only in repository
   *
   * Repository: query `ITicketRevenue[]` with pagination
   *
   * Used by:
   * - ticket-revenues/me/individual
   * - ticket-revenues/me               (day gorup)
   * - ticket-revenues/me/grouped       (sum all group)
   * - bank-statements/me/previous-days
   */
  async fetchTicketRevenues(
    args?: IFetchTicketRevenues,
  ): Promise<{ data: ITicketRevenue[]; countAll: number }> {
    const qArgs = await this.getQueryArgs(args);
    const query =
      `
      SELECT
        CAST(t.data AS STRING) AS partitionDate,
        t.hora AS processingHour,
        CAST(t.datetime_transacao AS STRING) AS transactionDateTime,
        CAST(t.datetime_processamento AS STRING) AS processingDateTime,
        t.datetime_captura AS captureDateTime,
        t.modo AS transportType,
        t.servico AS vehicleService,
        t.sentido AS directionId,
        t.id_veiculo AS vehicleId,
        t.id_cliente AS clientId,
        t.id_transacao AS transactionId,
        t.${qArgs.tTipoPgto} AS paymentMediaType,
        t.tipo_transacao AS transactionType,
        t.id_tipo_integracao AS transportIntegrationType,
        t.id_integracao AS integrationId,
        t.latitude AS transactionLat,
        t.longitude AS transactionLon,
        t.stop_id AS stopId,
        t.stop_lat AS stopLat,
        t.stop_lon AS stopLon,
        CASE WHEN t.tipo_transacao = 'Integração' THEN i.valor_transacao_total ELSE t.valor_transacao END AS transactionValue,
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
      `\nORDER BY partitionDate DESC, processingHour DESC` +
      (qArgs?.limit !== undefined ? `\nLIMIT ${qArgs.limit + 1}` : '') +
      (qArgs?.offset !== undefined ? `\nOFFSET ${qArgs.offset}` : '');
    const queryResult = await this.bigqueryService.runQuery(
      BQSInstances.smtr,
      query,
    );

    const count: number = queryResult[0].count;
    // Remove unwanted keys and remove last item (all null if empty)
    let ticketRevenues: ITicketRevenue[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      return i;
    });
    ticketRevenues.pop();
    ticketRevenues = this.mapTicketRevenues(ticketRevenues);

    return {
      data: ticketRevenues,
      countAll: count,
    };
  }

  private async getQueryArgs(args?: IFetchTicketRevenues): Promise<{
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
  private mapTicketRevenues(
    ticketRevenues: ITicketRevenue[],
  ): ITicketRevenue[] {
    return ticketRevenues.map((item: ITicketRevenue) => {
      const transactionType = item.transactionType;
      const paymentType = item.paymentMediaType;
      const integrationType = item.transportIntegrationType;
      Object.values(TRIntegrationTypeMap[0]);
      return {
        ...item,
        paymentMediaType:
          paymentType !== null
            ? TRPaymentTypeMap?.[paymentType] || paymentType
            : paymentType,
        transportIntegrationType:
          integrationType !== null
            ? TRIntegrationTypeMap?.[integrationType] || integrationType
            : integrationType,
        transactionType:
          transactionType !== null
            ? TRTransactionTypeMap?.[transactionType] || transactionType
            : transactionType,
      };
    });
  }

  public async getMeIndividual(
    validArgs: ITRGetMeIndividualValidArgs,
    paginationArgs: PaginationOptions,
  ): Promise<Pagination<ITRGetMeIndividualResponse>> {
    const { startDate, endDate } = getPaymentDates({
      endpoint: 'ticket-revenues',
      startDateStr: validArgs.startDate,
      endDateStr: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
    });

    const result = await this.fetchTicketRevenues({
      cpfCnpj: validArgs.user.getCpfCnpj(),
      startDate,
      endDate,
      getToday: true,
      limit: paginationArgs.limit,
      offset: (paginationArgs.page - 1) * paginationArgs.limit,
    });
    let ticketRevenuesResponse = result.data;

    if (ticketRevenuesResponse.length === 0) {
      return getPagination<ITRGetMeIndividualResponse>(
        {
          amountSum: 0,
          data: [],
        },
        {
          dataLenght: 0,
          maxCount: 0,
        },
        paginationArgs,
      );
    }

    ticketRevenuesResponse = this.removeTodayData(
      ticketRevenuesResponse,
      endDate,
    );

    return getPagination<ITRGetMeIndividualResponse>(
      {
        amountSum: this.getAmountSum(ticketRevenuesResponse),
        data: ticketRevenuesResponse,
      },
      {
        dataLenght: ticketRevenuesResponse.length,
        maxCount: result.countAll,
      },
      paginationArgs,
    );
  }

  /**
   * TODO: use it only in repository
   */
  getAmountSum<T extends ITicketRevenue | ITicketRevenuesGroup>(
    data: T[],
  ): number {
    return Number(
      data
        .reduce((sum, i) => sum + (this.getTransactionValue(i) || 0), 0)
        .toFixed(2),
    );
  }

  private getTransactionValue(
    item: ITicketRevenue | ITicketRevenuesGroup,
  ): number {
    if ('transactionValue' in item) {
      return item.transactionValue || 0;
    } else if ('transactionValueSum' in item) {
      return item.transactionValueSum || 0;
    } else {
      return 0;
    }
  }
}
