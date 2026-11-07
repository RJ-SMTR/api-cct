import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';

const MOTIVOS_PAGO = ['00', 'BD'];
const MOTIVO_ESTORNO = '02';

export function resolveStatusPagamento(
  statusRemessa: number,
  motivoStatusRemessa: string | null,
): StatusPagamento {
  if (statusRemessa === 5) {
    return StatusPagamento.PENDENCIA_PAGA;
  }
  if (statusRemessa === 2) {
    return StatusPagamento.AGUARDANDO_PAGAMENTO;
  }
  if (statusRemessa === 0 || statusRemessa === 1) {
    return StatusPagamento.A_PAGAR;
  }
  if (statusRemessa === 3 || (motivoStatusRemessa && MOTIVOS_PAGO.includes(motivoStatusRemessa))) {
    return StatusPagamento.PAGO;
  }
  if (motivoStatusRemessa === MOTIVO_ESTORNO) {
    return StatusPagamento.ERRO_ESTORNO;
  }
  return StatusPagamento.ERRO_REJEITADO;
}

export const buildStatusPagamentoCaseSql = (historyAlias: string) => `
  CASE
    WHEN ${historyAlias}."statusRemessa" = 5 THEN 'Pendencia Paga'
    WHEN ${historyAlias}."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN ${historyAlias}."statusRemessa" IN (0,1) THEN 'A Pagar'
    WHEN ${historyAlias}."motivoStatusRemessa" IN ('00', 'BD') OR ${historyAlias}."statusRemessa" = 3 THEN 'Pago'
    WHEN ${historyAlias}."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;
