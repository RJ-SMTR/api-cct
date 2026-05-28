import { AgendamentoPagamentoDTO } from 'src/agendamento/domain/dto/agendamento-pagamento.dto';
import { AgendamentoPagamentoRemessaDTO } from 'src/agendamento/domain/dto/agendamento-pagamento-remessa.dto';
import { ICronJob } from './cron-jobs.interfaces';

type BuildAutomationCronJobsArgs = {
  agendamentos: AgendamentoPagamentoDTO[];
  jobNamePrefix: string;
  onTick: (remessa: AgendamentoPagamentoRemessaDTO) => Promise<void>;
  timeZone?: string;
  now?: Date;
};

export type AgendaAutomationDiagnostic = {
  id?: number;
  included: boolean;
  reasons: string[];
};

export function buildAutomationCronJobs(args: BuildAutomationCronJobsArgs): ICronJob[] {
  const {
    agendamentos,
    jobNamePrefix,
    onTick,
    timeZone = 'America/Sao_Paulo',
    now = new Date(),
  } = args;

  const listaRemessas: AgendamentoPagamentoRemessaDTO[] = [];

  for (const agenda of agendamentos) {
    if (!shouldIncludeAgenda(agenda, now)) {
      continue;
    }

    const tipo = agenda.tipoBeneficiario;
    let remessaExistente = listaRemessas.find((r) => r.tipoBeneficiario === tipo);
    if (!remessaExistente) {
      const novaRemessa = new AgendamentoPagamentoRemessaDTO();
      instanciaRemessa(novaRemessa, agenda);
      listaRemessas.push(novaRemessa);
      remessaExistente = novaRemessa;
    } else {
      if (agenda.beneficiarioUsuario) {
        remessaExistente.beneficiarios.push(agenda.beneficiarioUsuario);
      }
    }
  }

  const cronsAutonomos: ICronJob[] = [];
  for (const rem of listaRemessas) {
    cronsAutonomos.push({
      name: `${jobNamePrefix}_${rem.tipoBeneficiario}_${rem.horario}`,
      cronJobParameters: {
        cronTime: getHorarioFormatado(remHours(rem.horario, 0)),
        onTick: async () => {
          await onTick(rem);
        },
        timeZone,
      },
    });
  }

  return cronsAutonomos;
}

export function getAutomationAgendaDiagnostics(
  agendamentos: AgendamentoPagamentoDTO[],
  now = new Date(),
): AgendaAutomationDiagnostic[] {
  return agendamentos.map((agenda) => {
    const validation = evaluateAgendaForAutomation(agenda, now);
    return {
      id: agenda.id,
      included: validation.isValid,
      reasons: validation.reasons,
    };
  });
}

function shouldIncludeAgenda(agenda: AgendamentoPagamentoDTO, now: Date): boolean {
  return evaluateAgendaForAutomation(agenda, now).isValid;
}

function evaluateAgendaForAutomation(
  agenda: AgendamentoPagamentoDTO,
  now: Date,
): { isValid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!agenda.status) {
    reasons.push('status_inativo');
  }

  if (!agenda.beneficiarioUsuario) {
    reasons.push('beneficiario_ausente');
  }

  if (!hasValidTimeFormat(agenda.horario)) {
    reasons.push('horario_invalido');
  }

  const weekdays = normalizeWeekdays(agenda.weekdays);
  if (weekdays.length > 0 && !weekdays.includes(now.getDay())) {
    reasons.push(`weekday_nao_compativel_hoje:${now.getDay()}`);
  }

  if (weekdays.length === 0) {
    const byDiaSemana = verificaDiaSemana(agenda.diaSemana, now);
    const byIntervalo = Boolean(verificarIntervalo(agenda.diaIntervalo, agenda.createdAt, now));
    if (!byDiaSemana && !byIntervalo) {
      reasons.push('recorrencia_nao_compativel_hoje');
    }
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}

function normalizeWeekdays(weekdays?: number[]): number[] {
  if (!Array.isArray(weekdays)) {
    return [];
  }

  return Array.from(
    new Set(
      weekdays
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ).sort((a, b) => a - b);
}

function hasValidTimeFormat(time?: string): boolean {
  if (!time) {
    return false;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.test(time);
}

function remHours(time: string, hoursToAdd: number): string {
  const [h, m, s = 0] = time.split(':').map(Number);

  const date = new Date();
  date.setHours(h, m, s);
  date.setHours(date.getHours() - hoursToAdd);

  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

function instanciaRemessa(
  remessa: AgendamentoPagamentoRemessaDTO,
  agenda: AgendamentoPagamentoDTO,
) {
  remessa.aprovacao = agenda.aprovacao;
  remessa.aprovacaoPagamento = agenda.aprovacaoPagamento;
  if (agenda.beneficiarioUsuario != null) {
    remessa.beneficiarios.push(agenda.beneficiarioUsuario);
  }
  remessa.diaIntervalo = agenda.diaIntervalo;
  remessa.diaInicioPagar = agenda.diaInicioPagar;
  remessa.diaFinalPagar = agenda.diaFinalPagar;
  remessa.pagador = agenda.pagador;
  remessa.tipoBeneficiario = agenda.tipoBeneficiario;
  remessa.horario = agenda.horario;
}

function getHorarioFormatado(time: string): string {
  // Aceita "HH:mm" ou "HH:mm:ss"
  const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);

  if (!match) {
    throw new Error('Formato inválido. Use HH:mm ou HH:mm:ss');
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  // Cron no formato: minuto hora dia-do-mês mês dia-da-semana
  // Ex: "30 13 * * *"
  return `${minutes} ${hours} * * *`;
}

function verificaDiaSemana(dia: number | undefined, now: Date): boolean {
  if (dia == null) {
    return false;
  }
  return now.getDay() + 1 === Number(dia);
}

function verificarIntervalo(
  diaIntervalo: number | undefined,
  createdAt: Date | undefined,
  now: Date,
) {
  if (diaIntervalo == null || createdAt == null) {
    return false;
  }

  let data = new Date(createdAt);
  const hoje = new Date(now);

  while (data <= hoje) {
    const nova = new Date(data);
    nova.setDate(data.getDate() + diaIntervalo);
    if (nova > hoje) return data; // o ciclo válido é o anterior
    data = nova;
  }

  return (
    data.getDate() === hoje.getDate() &&
    data.getMonth() === hoje.getMonth() &&
    data.getFullYear() === hoje.getFullYear()
  );
}
