import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { endOfDay, isToday, startOfDay } from 'date-fns';
import { ArquivoPublicacaoService } from 'src/cnab/service/arquivo-publicacao.service';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { formatDateYMD } from 'src/utils/date-utils';
import { getPagination } from 'src/utils/get-pagination';
import { getPaymentDates } from 'src/utils/payment-date-utils';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { DataSource } from 'typeorm';
import { TicketRevenueDTO } from './dtos/ticket-revenue.dto';
import { TicketRevenuesGroupDto } from './dtos/ticket-revenues-group.dto';
import { ITRGetMeIndividualValidArgs } from './interfaces/tr-get-me-individual-args.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';
import { TransacaoView } from 'src/transacao-bq/transacao-view.entity';
import { compactQuery } from 'src/utils/console-utils';

export interface TicketRevenuesIndividualOptions {
  where: {
    args?: {
      startDate: Date;
      endDate: Date;
      validArgs: ITRGetMeIndividualValidArgs;
    };
    transacaoView?: {
      idTransacao?: string[];
      operadoraCpfCnpj?: string[];
      datetimeTransacao?: { between: [Date, Date][] };
      datetimeProcessamento?: { between: [Date, Date][] };
      /** Se a TransacaoView é apenas de dias anteriores */
      isPreviousDays?: boolean;
    };
  };
  order?: {
    datetimeProcessamento?: 'ASC' | 'DESC';
    id?: 'ASC' | 'DESC';
  };
  limit?: number;
  offset?: number;
}

@Injectable()
export class TicketRevenuesRepositoryService {
  private logger: Logger = new Logger('TicketRevenuesRepository', { timestamp: true });

  /**
   * Regra de negócio:
   *
   * - Buscar todas as catracadas (transacao_view) no intervalo de data escolhido
   * - transacao_view chama arquivo_publicacao via item_transacao_agrupado
   * - Sabemos que a catracada foi paga através de `arquivo_publicacao.isPago`
   *
   * Observações:
   *
   * - Se `publicacao.isPago = true` mas `detalhe_a.ocorrenciasCnab` contém erro (ou vice-versa), os dados do banco estão inconsistentes.
   */

  constructor(
    private readonly transacaoViewService: TransacaoViewService,
    private arquivoPublicacaoService: ArquivoPublicacaoService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * TODO: use it only for repository services
   *
   * Filter: used by:
   * - ticket-revenues/get/me
   */
  removeTodayData<T extends TicketRevenueDTO | TicketRevenuesGroupDto>(data: T[], endDate: Date): T[] {
    const mostRecentDate = startOfDay(new Date(data[0].date));
    if (mostRecentDate > endOfDay(endDate)) {
      return data.filter((i) => !isToday(new Date(i.date)));
    } else {
      return data;
    }
  }

  public async getMeIndividual(validArgs: ITRGetMeIndividualValidArgs, paginationArgs: PaginationOptions): Promise<Pagination<ITRGetMeIndividualResponse>> {
    const { startDate, endDate } = getPaymentDates({
      endpoint: 'ticket-revenues',
      startDateStr: validArgs.startDate,
      endDateStr: validArgs.endDate,
      timeInterval: validArgs.timeInterval,
    });

    const revenues = await this.findManyIndividual({ where: { args: { startDate, endDate, validArgs } } });
    const paidSum = +revenues
      .filter((i) => i.isPago)
      .reduce((s, i) => s + i.paidValue, 0)
      .toFixed(2);
    const countAll = revenues.length;

    if (revenues.length === 0) {
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

    return getPagination<ITRGetMeIndividualResponse>(
      {
        paidSum,
        amountSum: TicketRevenueDTO.getAmountSum(revenues),
        data: revenues,
      },
      {
        dataLenght: revenues.length,
        maxCount: countAll,
      },
      paginationArgs,
    );
  }

  async findManyIndividual(options: TicketRevenuesIndividualOptions): Promise<TicketRevenueDTO[]> {
    const { args, transacaoView } = options.where;
    if (!args && !transacaoView) {
      throw new Error('É obrigatório filtrar o TransacaoView em TicketRevenueDto, para tornar a consulta rápida.');
    }

    const whereTransacaoView: string[] = [];
    const tv1 = TransacaoView.getSqlFields('tv1');
    if (args) {
      whereTransacaoView.push(`DATE(${tv1.datetimeProcessamento}) BETWEEN '${formatDateYMD(args.startDate)}' AND '${formatDateYMD(args.endDate)}'`);
      if (args.validArgs.user.cpfCnpj) {
        whereTransacaoView.push(`${tv1.operadoraCpfCnpj} = '${options.where.args?.validArgs.user.cpfCnpj}'`);
      }
    }
    if (transacaoView) {
      if (transacaoView?.idTransacao?.length) {
        whereTransacaoView.push(`${tv1.idTransacao} IN ('${transacaoView?.idTransacao.join("','")}')`);
      }
      if (transacaoView?.operadoraCpfCnpj?.length) {
        whereTransacaoView.push(`${tv1.operadoraCpfCnpj} IN ('${transacaoView?.operadoraCpfCnpj.join("','")}')`);
      }
      if (transacaoView?.datetimeTransacao) {
        const betweenStr = transacaoView.datetimeTransacao.between.map(([start, end]) => `${tv1.datetimeTransacao}::DATE BETWEEN '${formatDateYMD(start)}' AND '${formatDateYMD(end)}'`).join(' OR ');
        whereTransacaoView.push(`${betweenStr}`);
      }
      if (transacaoView?.datetimeProcessamento) {
        const betweenStr = transacaoView.datetimeProcessamento.between.map(([start, end]) => `${tv1.datetimeProcessamento}::DATE BETWEEN '${formatDateYMD(start)}' AND '${formatDateYMD(end)}'`).join(' OR ');
        whereTransacaoView.push(`${betweenStr}`);
      }
      if (transacaoView.isPreviousDays) {
        whereTransacaoView.push(`${tv1.datetimeProcessamento}::DATE > ${tv1.datetimeTransacao}::DATE`);
      }
    }

    const tv = TransacaoView.getSqlFields('tv');
    const order: string[] = [];
    if (options?.order?.datetimeProcessamento) {
      order.push(`${tv1.datetimeProcessamento} ${options.order.datetimeProcessamento}`);
    }
    if (options?.order?.id) {
      order.push(`${tv1.id} ${options.order.id}`);
    }

    let query = `
    SELECT
        1 AS "count",
        tv.id,
        MIN(ita.id) AS ita_id, da.id AS da_id,
        MIN(tv."datetimeProcessamento") AS "date",
        EXTRACT(HOUR FROM MIN(tv."datetimeProcessamento"))::INT AS "processingHour",
        MIN(tv."datetimeTransacao")::VARCHAR AS "transactionDateTime",
        MIN(tv."datetimeProcessamento")::VARCHAR AS "processingDateTime",
        MIN(tv."datetimeCaptura")::VARCHAR AS "captureDateTime",
        MIN(tv."idTransacao") AS "transactionId",
        MIN(tv."tipoPagamento") AS "paymentMediaType",
        MIN(tv."tipoTransacao") AS "transactionType",
        MIN(tv."valorTransacao")::FLOAT AS "transactionValue",
        CASE WHEN MIN(tv."valorPago") IS NOT NULL THEN MIN(tv."valorPago")::FLOAT ELSE 0 END AS "paidValue",
        BOOL_AND(ap."isPago") AS "isPago",
        MIN(ap."dataEfetivacao") AS "dataEfetivacao",
        CASE WHEN COUNT(o.id) > 0 THEN json_agg(json_build_object('id', o.id, 'code', o.code, 'message', o.message, 'detalheAId', o."detalheAId")) ELSE '[]' END  AS ocorrencias
    FROM (SELECT tv1.* FROM transacao_view tv1${whereTransacaoView ? ` WHERE (${whereTransacaoView.join(') AND (')}` : ''}) ORDER BY ${order.length ? order.join(', ') : 'tv1.id DESC'}) tv
    LEFT JOIN item_transacao_agrupado ita ON ita.id = tv."itemTransacaoAgrupadoId"
    LEFT JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = ita.id
    LEFT JOIN ocorrencia o ON o."detalheAId" = da.id
    LEFT JOIN item_transacao it ON it."itemTransacaoAgrupadoId" = ita.id
    LEFT JOIN arquivo_publicacao ap ON ap."itemTransacaoId" = it.id
    GROUP BY (tv.id, da.id)
    `;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const result: any[] = await queryRunner.query(compactQuery(query));
    queryRunner.release();
    const revenueIndividuals = result.map((r) => new TicketRevenueDTO(r));
    return revenueIndividuals;
  }
}
