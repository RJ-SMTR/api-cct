import { resolveStucPaymentWindow } from './stuc-payment-window.util';

type StucPivotInputRow = { dataReferencia: Date; valor: number };

export type StucPivotOutputRow<T> = T & {
  valor: number;
  dataOrdemPagamento1: Date | null;
  valorOrdemPagamento1: number | null;
  dataOrdemPagamento2: Date | null;
  valorOrdemPagamento2: number | null;
  dataOrdemPagamento3: Date | null;
  valorOrdemPagamento3: number | null;
  dataOrdemPagamento4: Date | null;
  valorOrdemPagamento4: number | null;
};

/**
 * Agrupa linhas no grão "um dia" (uma por dataReferencia distinta) em linhas no grão "uma
 * janela de pagamento" (resolveStucPaymentWindow), posicionando cada dia na coluna
 * correspondente ao seu dayIndex. Nunca produz overflow: a janela nunca passa de 4 dias.
 */
export function pivotStucGratuidadeRows<T extends StucPivotInputRow>(
  rows: T[],
  groupKeyFn: (row: T) => string,
): Array<StucPivotOutputRow<T>> {
  const groups = new Map<string, { firstRow: T; days: Array<{ data: Date; valor: number } | undefined> }>();

  for (const r of rows) {
    const { windowKey, dayIndex } = resolveStucPaymentWindow(r.dataReferencia);
    const groupKey = `${groupKeyFn(r)}::${windowKey}`;
    const group = groups.get(groupKey) ?? { firstRow: r, days: [undefined, undefined, undefined, undefined] };
    const existing = group.days[dayIndex];
    group.days[dayIndex] = existing
      ? { data: existing.data, valor: existing.valor + r.valor }
      : { data: r.dataReferencia, valor: r.valor };
    groups.set(groupKey, group);
  }

  return Array.from(groups.values()).map(({ firstRow, days }) => {
    const valor = days.reduce((sum, day) => sum + (day?.valor ?? 0), 0);
    return {
      ...firstRow,
      valor,
      dataOrdemPagamento1: days[0]?.data ?? null,
      valorOrdemPagamento1: days[0]?.valor ?? null,
      dataOrdemPagamento2: days[1]?.data ?? null,
      valorOrdemPagamento2: days[1]?.valor ?? null,
      dataOrdemPagamento3: days[2]?.data ?? null,
      valorOrdemPagamento3: days[2]?.valor ?? null,
      dataOrdemPagamento4: days[3]?.data ?? null,
      valorOrdemPagamento4: days[3]?.valor ?? null,
    };
  });
}
