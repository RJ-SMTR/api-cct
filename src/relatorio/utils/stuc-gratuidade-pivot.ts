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
  // Who a window belongs to (usually nome + CPF). groupKeyFn may split one favorecido's window
  // into several rows (by status, consorcio, error code...). Without this, each of those rows
  // filled the other rows' days with 0, so a day with a real order showed Valor Ordem 0 in the
  // export. Defaults to groupKeyFn (one row per window, no split).
  fillScopeKeyFn: (row: T) => string = groupKeyFn,
): Array<StucPivotOutputRow<T>> {
  const groups = new Map<
    string,
    { firstRow: T; dataPagamento: Date; scopeKey: string; days: Array<{ data: Date; valor: number } | undefined> }
  >();
  // Per favorecido + window: which days have a lancamento in any of its rows, and which row
  // (the first one seen) carries the zero-filled days that have none.
  const scopes = new Map<string, { diasComLancamento: Set<number>; firstGroupKey: string }>();

  for (const r of rows) {
    const { windowKey, dayIndex, dataPagamento } = resolveStucPaymentWindow(r.dataReferencia);
    const groupKey = `${groupKeyFn(r)}::${windowKey}`;
    const scopeKey = `${fillScopeKeyFn(r)}::${windowKey}`;
    const scope = scopes.get(scopeKey) ?? { diasComLancamento: new Set<number>(), firstGroupKey: groupKey };
    scope.diasComLancamento.add(dayIndex);
    scopes.set(scopeKey, scope);
    const group = groups.get(groupKey) ?? { firstRow: r, dataPagamento, scopeKey, days: [undefined, undefined, undefined, undefined] };
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

  return Array.from(groups.entries()).map(([groupKey, { firstRow, dataPagamento, scopeKey, days }]) => {
    // Dia dentro do comprimento real da janela (3 ou 4, conforme dataPagamento) sem lançamento:
    // mostra a data real do dia com valor 0, em vez de null - sem isso, um dia sem gratuidade
    // no meio da janela parecia uma data errada em vez de "dia sem valor" (achado testando
    // contra produção). Posição fora do comprimento real (ex.: a 4ª de uma janela de 3 dias)
    // continua null: esse dia nunca existiu, não é "sem lançamento".
    // Dia sem lançamento nesta linha mas com lançamento em outra linha do mesmo favorecido e
    // janela: fica null (data e valor), para o export e a tela pularem a posição em vez de
    // mostrar Valor Ordem 0 numa ordem que tem valor. Dia sem lançamento em nenhuma linha: o 0
    // aparece uma vez só, na primeira linha da janela.
    const scope = scopes.get(scopeKey) ?? { diasComLancamento: new Set<number>(), firstGroupKey: groupKey };
    const windowDays = resolveStucWindowDays(dataPagamento);
    const filled = windowDays.map((data, i) => {
      if (days[i]) return days[i];
      if (scope.diasComLancamento.has(i) || scope.firstGroupKey !== groupKey) return undefined;
      return { data, valor: 0 };
    });
    const valor = filled.reduce((sum, day) => sum + (day?.valor ?? 0), 0);
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

// valorMin/valorMax sobre o total de cada favorecido no periodo (soma das janelas dele), nao sobre
// cada janela - a mesma regra nos dois relatorios (regra de Rayanne, 2026-11-11).
export function filtrarPeloTotalDoFavorecido<T extends { valor: number | string }>(
  rows: T[],
  chave: (row: T) => string,
  valorMin?: number,
  valorMax?: number,
): T[] {
  if (valorMin === undefined && valorMax === undefined) return rows;
  const totais = new Map<string, number>();
  for (const row of rows) totais.set(chave(row), (totais.get(chave(row)) ?? 0) + Number(row.valor));
  return rows.filter((row) => {
    const total = totais.get(chave(row)) ?? 0;
    return (valorMin === undefined || total >= valorMin) && (valorMax === undefined || total <= valorMax);
  });
}
