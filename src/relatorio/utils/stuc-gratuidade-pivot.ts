import { resolveStucPaymentWindow, resolveStucWindowDays } from './stuc-payment-window.util';

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
  const groups = new Map<
    string,
    { firstRow: T; dataPagamento: Date; days: Array<{ data: Date; valor: number } | undefined> }
  >();

  for (const r of rows) {
    const { windowKey, dayIndex, dataPagamento } = resolveStucPaymentWindow(r.dataReferencia);
    const groupKey = `${groupKeyFn(r)}::${windowKey}`;
    const group = groups.get(groupKey) ?? { firstRow: r, dataPagamento, days: [undefined, undefined, undefined, undefined] };
    // pg devolve coluna numeric/decimal como string (evita perda de precisão) - sem Number()
    // aqui, "sum + valor" vira concatenação de string assim que um operando é string (ex.:
    // "80.00000" + "10.00000" = "080.0000010.00000"), não soma. Confirmado em produção via
    // Movimentação Financeira, cujo SUM(valor) do SQL chega como string.
    const valorNumerico = Number(r.valor);
    const existing = group.days[dayIndex];
    group.days[dayIndex] = existing
      ? { data: existing.data, valor: existing.valor + valorNumerico }
      : { data: r.dataReferencia, valor: valorNumerico };
    groups.set(groupKey, group);
  }

  return Array.from(groups.values()).map(({ firstRow, dataPagamento, days }) => {
    // Dia dentro do comprimento real da janela (3 ou 4, conforme dataPagamento) sem lançamento:
    // mostra a data real do dia com valor 0, em vez de null - sem isso, um dia sem gratuidade
    // no meio da janela parecia uma data errada em vez de "dia sem valor" (achado testando
    // contra produção). Posição fora do comprimento real (ex.: a 4ª de uma janela de 3 dias)
    // continua null: esse dia nunca existiu, não é "sem lançamento".
    const windowDays = resolveStucWindowDays(dataPagamento);
    const filled = windowDays.map((data, i) => days[i] ?? { data, valor: 0 });
    const valor = filled.reduce((sum, day) => sum + day.valor, 0);
    return {
      ...firstRow,
      valor,
      dataOrdemPagamento1: filled[0]?.data ?? null,
      valorOrdemPagamento1: filled[0]?.valor ?? null,
      dataOrdemPagamento2: filled[1]?.data ?? null,
      valorOrdemPagamento2: filled[1]?.valor ?? null,
      dataOrdemPagamento3: filled[2]?.data ?? null,
      valorOrdemPagamento3: filled[2]?.valor ?? null,
      dataOrdemPagamento4: filled[3]?.data ?? null,
      valorOrdemPagamento4: filled[3]?.valor ?? null,
    };
  });
}
