import { PermissionarioRoleEnum } from "src/permissionario-role/permissionario-role.enum";

export interface IBigqueryFindOrdemPagamento {
  cpfCnpj?: string;
  permissionarioRole?: PermissionarioRoleEnum | null;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  getToday?: boolean;
  previousDaysOnly?: boolean;
  /** Ignore if valorTotalTransacaoLiquido = 0 */
  ignoreTransacaoLiquidoZero?: boolean;
}
