import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { endOfDay, isToday, startOfDay } from 'date-fns';
import { ArquivoPublicacaoService } from 'src/cnab/service/arquivo-publicacao.service';
import { TransacaoViewService } from 'src/transacao-bq/transacao-view.service';
import { getDateYMDString } from 'src/utils/date-utils';
import { getPagination } from 'src/utils/get-pagination';
import { getPaymentDates } from 'src/utils/payment-date-utils';
import { PaginationOptions } from 'src/utils/types/pagination-options';
import { Pagination } from 'src/utils/types/pagination.type';
import { DataSource } from 'typeorm';
import { TicketRevenueDTO } from './dtos/ticket-revenue.dto';
import { TicketRevenuesGroupDto } from './dtos/ticket-revenues-group.dto';
import { ITRGetMeIndividualValidArgs } from './interfaces/tr-get-me-individual-args.interface';
import { ITRGetMeIndividualResponse } from './interfaces/tr-get-me-individual-response.interface';

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
  private readonly SELECT_REVENUES_INDIVIDUAL = `
    SELECT
        DISTINCT ON (tv.id)
        1 AS "count",
        tv."datetimeProcessamento" AS "date",
        EXTRACT(HOUR FROM tv."datetimeProcessamento")::INT AS "processingHour",
        tv."datetimeTransacao"::VARCHAR AS "transactionDateTime",
        tv."datetimeProcessamento"::VARCHAR AS "processingDateTime",
        tv."datetimeCaptura"::VARCHAR AS "captureDateTime",
        tv."idTransacao" AS "transactionId",
        tv."tipoPagamento" AS "paymentMediaType",
        tv."tipoTransacao" AS "transactionType",
        tv."valorTransacao"::FLOAT AS "transactionValue",
        tv."valorPago"::FLOAT AS "paidValue",
        ap."isPago",
        tv."itemTransacaoAgrupadoId",
        CASE WHEN ap.id IS NOT NULL THEN json_build_object(
            'id', ap.id
        ) ELSE NULL END AS "arquivoPublicacao",
        da."ocorrenciasCnab"
    FROM transacao_view tv
    LEFT JOIN item_transacao_agrupado ita ON ita.id = tv."itemTransacaoAgrupadoId"
    LEFT JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = ita.id
    LEFT JOIN item_transacao it ON it."itemTransacaoAgrupadoId" = ita.id
    LEFT JOIN arquivo_publicacao ap ON ap."itemTransacaoId" = it.id
  `;

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

    const revenues = await this.findManyIndividual(startDate, endDate, validArgs);
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

  async findManyIndividual(startDate: Date, endDate: Date, validArgs: ITRGetMeIndividualValidArgs): Promise<TicketRevenueDTO[]> {
    const where: string[] = [];
    where.push(`DATE(tv."datetimeProcessamento") BETWEEN '${getDateYMDString(startDate)}' AND '${getDateYMDString(endDate)}'`);
    if (validArgs.user.cpfCnpj) {
      where.push(`tv."operadoraCpfCnpj" = '${validArgs.user.cpfCnpj}'`);
    }
    let query = this.SELECT_REVENUES_INDIVIDUAL + `    WHERE (${where.join(') AND (')})`;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const revenueIndividuals = result.map((r) => new TicketRevenueDTO(r));
    return revenueIndividuals;
  }

  // /**
  //  * Apenas soma se status = pago
  //  */
  // getAmountSum<T extends TicketRevenueDTO | TicketRevenuesGroupDto>(data: T[]): number {
  //   return +data.reduce((sum, i) => sum + this.getTransactionValue(i), 0).toFixed(2);
  // }

  // private getTransactionValue(item: TicketRevenueDTO | TicketRevenuesGroupDto): number {
  //   if ('transactionValue' in item) {
  //     return item.transactionValue || 0;
  //   } else if ('transactionValueSum' in item) {
  //     return item.transactionValueSum || 0;
  //   } else {
  //     return 0;
  //   }
  // }
}
