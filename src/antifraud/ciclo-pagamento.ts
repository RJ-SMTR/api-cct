/**
 * Payment cycle of the modais (STPC/STPL/TEC) that contains `referencia`,
 * by `dataCaptura` day, as `YYYY-MM-DD` strings in UTC.
 *
 * Same rule as `CronJobsService.calcularPeriodoPagamento`:
 * - Friday to Monday: paid on Tuesday;
 * - Tuesday to Thursday: paid on Friday.
 */
export interface CicloPagamento {
  dataInicio: string;
  dataFim: string;
  dataPagamento: string;
}

const DIA_MS = 24 * 60 * 60 * 1000;

const SEXTA = 5;
const TERCA = 2;

export function getCicloPagamento(referencia: Date): CicloPagamento {
  const dia = Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), referencia.getUTCDate());
  const diaSemana = new Date(dia).getUTCDay();
  const isFimDeSemanaEstendido = [5, 6, 0, 1].includes(diaSemana);

  // Days back to the cycle start (Friday or Tuesday) and cycle length.
  const inicioSemana = isFimDeSemanaEstendido ? SEXTA : TERCA;
  const diasDesdeInicio = (diaSemana - inicioSemana + 7) % 7;
  const diasAteFim = isFimDeSemanaEstendido ? 3 : 2;

  const inicio = dia - diasDesdeInicio * DIA_MS;
  const fim = inicio + diasAteFim * DIA_MS;
  const pagamento = fim + DIA_MS;

  return {
    dataInicio: toIsoDate(inicio),
    dataFim: toIsoDate(fim),
    dataPagamento: toIsoDate(pagamento),
  };
}

function toIsoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}
