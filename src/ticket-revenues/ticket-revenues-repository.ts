import { Injectable, Logger } from '@nestjs/common';
import { endOfDay, isToday, startOfDay } from 'date-fns';
import { BigquerySource, BigqueryService } from 'src/bigquery/bigquery.service';
import { appSettings } from 'src/settings/app.settings';
import { BigqueryEnvironment } from 'src/settings/enums/bigquery-env.enum';
import { SettingsService } from 'src/settings/settings.service';
import { TransacaoView } from 'src/transacao-bq/transacao-view.entity';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { isCpfOrCnpj } from 'src/utils/cpf-cnpj';
import { getPagination } from 'src/utils/get-pagination';
import { logWarn } from 'src/utils/log-utils';
import { getPaymentDates } from 'src/utils/payment-date-utils';
import { QueryBuilder } from 'src/utils/query-builder/query-builder';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { Between, FindOptionsWhere } from 'typeorm';
import { IFetchTicketRevenues } from './interfaces/fetch-ticket-revenues.interface';
import { TicketRevenuesGroupDto } from './dtos/ticket-revenues-group.dto';
import { ITRGetMeIndividualValidArgs } from './interfaces/tr-get-me-individual-args.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';
import {
  TRIntegrationTypeMap,
  TRPaymentTypeMap,
  TRTransactionTypeMap,
} from './maps/ticket-revenues.map';
import { TicketRevenueDTO } from './dtos/ticket-revenue.dto';

@Injectable()
export class TicketRevenuesRepositoryService {
  private logger: Logger = new Logger('TicketRevenuesRepository', {
    timestamp: true,
  });

  constructor(
    private readonly bigqueryService: BigqueryService,
    private readonly settingsService: SettingsService,
    private readonly transacaoViewService: TransacaoViewService,
  ) {}

  /**
   * TODO: use it only for repository services
   *
   * Filter: used by:
   * - ticket-revenues/get/me
   */
  removeTodayData<T extends TicketRevenueDTO | TicketRevenuesGroupDto>(
    data: T[],
    endDate: Date,
  ): T[] {
    const mostRecentDate = startOfDay(new Date(data[0].date));
    if (mostRecentDate > endOfDay(endDate)) {
      return data.filter((i) => !isToday(new Date(i.date)));
    } else {
      return data;
    }
  }

  /**
   * TODO: use it only in repository
   *
   * Repository: query `TicketRevenueDTO[]` with pagination
   *
   * Used by:
   * - ticket-revenues/me/individual
   * - ticket-revenues/me               (day gorup)
   * - ticket-revenues/me/grouped       (sum all group)
   * - bank-statements/me/previous-days
   */
  async fetchTicketRevenues(
    args?: IFetchTicketRevenues,
  ): Promise<{ data: TicketRevenueDTO[]; countAll: number }> {
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
    const queryResult = await this.bigqueryService.query(
      BigquerySource.smtr,
      query,
    );

    const count: number = queryResult[0].count;
    // Remove unwanted keys and remove last item (all null if empty)
    let ticketRevenues: TicketRevenueDTO[] = queryResult.map((i) => {
      delete i.status;
      delete i.count;
      return new TicketRevenueDTO(i);
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
      logWarn(
        this.logger,
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
    ticketRevenues: TicketRevenueDTO[],
  ): TicketRevenueDTO[] {
    return ticketRevenues.map((item: TicketRevenueDTO) => {
      const transactionType = item.transactionType;
      const paymentType = item.paymentMediaType;
      const integrationType = item.transportIntegrationType;
      Object.values(TRIntegrationTypeMap[0]);
      return new TicketRevenueDTO({
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
      });
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

    const revenues = await this.findTransacaoView(
      startDate,
      endDate,
      validArgs,
    );
    const paidSum = +revenues
      .filter((i) => i.isPago)
      .reduce((s, i) => s + i.paidValue, 0)
      .toFixed(2);
    const countAll = revenues.length;
    let ticketRevenuesResponse = revenues;

    if (ticketRevenuesResponse.length === 0) {
      return getPagination<ITRGetMeIndividualResponse>(
        {
          amountSum: 0,
          paidSum: 0,
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
        paidSum,
        amountSum: this.getAmountSum(ticketRevenuesResponse),
        data: ticketRevenuesResponse,
      },
      {
        dataLenght: ticketRevenuesResponse.length,
        maxCount: countAll,
      },
      paginationArgs,
    );
  }

  private async findTransacaoView(
    startDate: Date,
    endDate: Date,
    validArgs: ITRGetMeIndividualValidArgs,
  ) {
    const fetchArgs: IFetchTicketRevenues = {
      cpfCnpj: validArgs.user.getCpfCnpj(),
      startDate,
      endDate,
      getToday: true,
    };

    const betweenDate: FindOptionsWhere<TransacaoView> = {
      datetimeProcessamento: Between(
        fetchArgs.startDate as Date,
        fetchArgs.endDate as Date,
      ),
    };
    const where: FindOptionsWhere<TransacaoView>[] = [
      {
        ...betweenDate,
        operadoraCpfCnpj: validArgs.user.getCpfCnpj(),
      },
      {
        ...betweenDate,
        consorcioCnpj: validArgs.user.getCpfCnpj(),
      },
    ];
    const today = new Date();
    if (fetchArgs.getToday) {
      const isTodayDate: FindOptionsWhere<TransacaoView> = {
        datetimeProcessamento: Between(startOfDay(today), endOfDay(today)),
      };
      where.push({
        ...isTodayDate,
        operadoraCpfCnpj: validArgs.user.getCpfCnpj(),
      });
      where.push({
        ...isTodayDate,
        consorcioCnpj: validArgs.user.getCpfCnpj(),
      });
    }

    const transacaoViews = await this.transacaoViewService.find(where);
    return transacaoViews.map((i) => i.toTicketRevenue());
  }

  /**
   * Apenas soma se status = pago
   */
  getAmountSum<T extends TicketRevenueDTO | TicketRevenuesGroupDto>(
    data: T[],
  ): number {
    return +data
      .reduce((sum, i) => sum + this.getTransactionValue(i), 0)
      .toFixed(2);
  }

  private getTransactionValue(
    item: TicketRevenueDTO | TicketRevenuesGroupDto,
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
