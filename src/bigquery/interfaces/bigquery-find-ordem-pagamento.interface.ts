import { TipoFavorecidoEnum } from "src/tipo-favorecido/tipo-favorecido.enum";

export interface IBigqueryFindOrdemPagamento {
  cpfCnpj?: string;
  tipoFavorecido?: TipoFavorecidoEnum | null;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  getToday?: boolean;
  previousDaysOnly?: boolean;
  /** Ignore if valorTotalTransacaoLiquido = 0 */
  ignoreTransacaoLiquidoZero?: boolean;
}
