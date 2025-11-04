import { TipoFavorecidoEnum } from 'src/domain/enum/tipo-favorecido.enum';

export interface IBigqueryFindOrdemPagamento {
  operadorCpfs?: string[];
  tipoFavorecido?: TipoFavorecidoEnum | null;
  consorcioName?: string[];
  startDate: Date;
  endDate: Date;
  limit?: number;
  offset?: number;
  getToday?: boolean;
  previousDaysOnly?: boolean;
  /** Ignore if valorTotalTransacaoLiquido = 0 */
  ignoreTransacaoLiquidoZero?: boolean;
}
