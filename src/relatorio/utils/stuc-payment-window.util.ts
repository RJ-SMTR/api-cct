import { format, nextFriday, nextTuesday, subDays } from 'date-fns';

export type StucPaymentWindow = {
  windowKey: string;
  dayIndex: 0 | 1 | 2 | 3;
  dataPagamento: Date;
};

/**
 * Reimplementa a regra de `calcularPeriodoPagamento` (src/cron-jobs/cron-jobs.service.ts)
 * sem acoplar o módulo de relatórios ao de cron-jobs: dado o dia de uma ordem, devolve a
 * identidade da janela de pagamento vigente (sexta-segunda paga terça; terça-quinta paga
 * sexta) e a posição do dia dentro dela.
 */
export function resolveStucPaymentWindow(dataReferencia: Date): StucPaymentWindow {
  const dayOfWeek = dataReferencia.getDay();
  const isFimDeSemanaEstendido = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0 || dayOfWeek === 1;

  if (isFimDeSemanaEstendido) {
    const dayIndexByDayOfWeek: Record<number, 0 | 1 | 2 | 3> = { 5: 0, 6: 1, 0: 2, 1: 3 };
    const dataPagamento = nextTuesday(dataReferencia);
    return { windowKey: format(dataPagamento, 'yyyy-MM-dd'), dayIndex: dayIndexByDayOfWeek[dayOfWeek], dataPagamento };
  }

  const dayIndexByDayOfWeek: Record<number, 0 | 1 | 2> = { 2: 0, 3: 1, 4: 2 };
  const dataPagamento = nextFriday(dataReferencia);
  return { windowKey: format(dataPagamento, 'yyyy-MM-dd'), dayIndex: dayIndexByDayOfWeek[dayOfWeek], dataPagamento };
}

/**
 * Datas de calendário de cada dia da janela de pagamento, na ordem do `dayIndex` - 4 datas
 * (sexta a segunda) para um pagamento de terça, 3 datas (terça a quinta) para um pagamento de
 * sexta. Usada para preencher o dia real de uma posição da janela que não teve lançamento
 * (ver pivotStucGratuidadeRows), sem reparsear o `windowKey` formatado.
 */
export function resolveStucWindowDays(dataPagamento: Date): Date[] {
  const dayOfWeek = dataPagamento.getDay();
  if (dayOfWeek === 2) return [4, 3, 2, 1].map((offset) => subDays(dataPagamento, offset));
  if (dayOfWeek === 5) return [3, 2, 1].map((offset) => subDays(dataPagamento, offset));
  throw new Error(`Data de pagamento STUC inesperada (dia da semana ${dayOfWeek}): esperado terça (2) ou sexta (5)`);
}
