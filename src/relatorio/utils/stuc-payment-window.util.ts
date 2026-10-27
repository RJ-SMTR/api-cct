import { format, nextFriday, nextTuesday } from 'date-fns';

export type StucPaymentWindow = {
  windowKey: string;
  dayIndex: 0 | 1 | 2 | 3;
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
    return { windowKey: format(dataPagamento, 'yyyy-MM-dd'), dayIndex: dayIndexByDayOfWeek[dayOfWeek] };
  }

  const dayIndexByDayOfWeek: Record<number, 0 | 1 | 2> = { 2: 0, 3: 1, 4: 2 };
  const dataPagamento = nextFriday(dataReferencia);
  return { windowKey: format(dataPagamento, 'yyyy-MM-dd'), dayIndex: dayIndexByDayOfWeek[dayOfWeek] };
}
