import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import { getStatusRemessaEnumByValue } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { OrdemPagamentoAgrupadoMensalDto } from 'src/cnab/novo-remessa/dto/ordem-pagamento-agrupado-mensal.dto';
import { OrdemPagamentoMensalDto } from 'src/cnab/novo-remessa/dto/ordem-pagamento-mensal.dto';
import { OrdemPagamentoSemanalDto } from 'src/cnab/novo-remessa/dto/ordem-pagamento-semanal.dto';
import { RoleEnum } from 'src/roles/roles.enum';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { AgenteUserResponseDto } from './dtos/agente-user-response.dto';
import { AgentesDashboardQueryDto } from './dtos/agentes-dashboard-query.dto';
import {
  AgentAssociationOption,
  AgentesRepository,
  DashboardDataQuery,
  DashboardMonthData,
  DashboardPaymentCycle,
  DashboardPhotoEntry,
  DashboardWorkDay,
} from './agentes.repository';

type DashboardMonthlyPayment = {
  paymentDate: string;
  dataTentativaPagamento: string | null;
  dataEfetivaPagamento: string | null;
  paymentDayType: 'terça-feira' | 'sexta-feira' | 'outro';
  validPhotosCount: number;
  rejectedPhotosCount: number;
  paymentStatus: string;
  pendingReason: string | null;
  totalPaymentValue: number;
  coveredDaysCount: number;
};

type DashboardWeeklyDay = {
  date: string;
  periodLabel: string;
  validPhotosCount: number;
  rejectedPhotosCount: number;
  paymentStatus: string;
  pendingReason: string | null;
  totalPaymentValue: number;
};

type DashboardResponseBase = {
  month: string;
  associacoes: AgentAssociationOption[];
  validPhotosCount: number;
  rejectedPhotosCount: number;
  consolidatedPaymentValue: number;
  rejectionReasons: Array<{
    reason: string;
    count: number;
  }>;
  monthlyPayments: DashboardMonthlyPayment[];
};

@Injectable()
export class AgentesService {
  private readonly defaultPendingReason =
    'Crédito ou Débito Cancelado pelo Pagador';

  constructor(private readonly agentesRepository: AgentesRepository) { }

  async getAgentUsers(): Promise<AgenteUserResponseDto[]> {
    const users = await this.agentesRepository.findAgentUsers();

    return users.map(
      (user) =>
        new AgenteUserResponseDto(
          user,
          this.agentesRepository.getAgentAssociationOptionsFromUser(user),
        ),
    );
  }

  async getMonthly(
    yearMonth: string,
    userId: number,
  ): Promise<OrdemPagamentoMensalDto> {
    const normalizedYearMonth = String(yearMonth || '').trim();
    const yearMonthAsDate = /^\d{4}-\d{2}$/.test(normalizedYearMonth)
      ? `${normalizedYearMonth}-01`
      : normalizedYearMonth;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(yearMonthAsDate)) {
      throw new BadRequestException('yearMonth deve estar no formato YYYY-MM');
    }

    const rows = await this.agentesRepository.findMonthlyByUserId(
      yearMonthAsDate,
      userId,
    );

    const result = new OrdemPagamentoMensalDto();
    result.ordens = rows.map((row) => {
      const dto = new OrdemPagamentoAgrupadoMensalDto();
      const ordemPagamentoAgrupadoIds = row.ordemPagamentoAgrupadoIds
        ? String(row.ordemPagamentoAgrupadoIds).trim()
        : '';
      const ordemPagamentoAgrupadoId = ordemPagamentoAgrupadoIds
        ? Number(ordemPagamentoAgrupadoIds.split(',')[0])
        : null;

      dto.ordemPagamentoAgrupadoIds =
        ordemPagamentoAgrupadoIds || (null as any);
      dto.ordemPagamentoAgrupadoId = ordemPagamentoAgrupadoId as any;
      dto.data = new Date(row.dataTentativaPagamento || row.data) as any;
      dto.valorTotal = Number(row.valorTotal || 0);
      dto.statusRemessa =
        row.statusRemessa === null ? (null as any) : Number(row.statusRemessa);
      dto.motivoStatusRemessa =
        row.motivoStatusRemessa === null
          ? (null as any)
          : row.motivoStatusRemessa;
      dto.descricaoStatusRemessa =
        row.statusRemessa === null
          ? (null as any)
          : getStatusRemessaEnumByValue(Number(row.statusRemessa) as any) ??
            (null as any);
      dto.descricaoMotivoStatusRemessa = row.motivoStatusRemessa
        ? OcorrenciaEnum[row.motivoStatusRemessa as keyof typeof OcorrenciaEnum]
        : (null as any);
      dto.dataPagamento = row.dataEfetivaPagamento
        ? (new Date(row.dataEfetivaPagamento) as any)
        : (null as any);
      (dto as any).dataTentativaPagamento = row.data ?? null;
      (dto as any).dataEfetivaPagamento = row.dataEfetivaPagamento ?? null;
      return dto;
    });

    result.valorTotal = result.ordens.reduce(
      (sum, item) => sum + Number(item.valorTotal || 0),
      0,
    );
    result.valorTotalPago = result.ordens.reduce((sum, item) => {
      if (
        item.motivoStatusRemessa &&
        ['00', 'BD'].includes(String(item.motivoStatusRemessa))
      ) {
        return sum + Number(item.valorTotal || 0);
      }
      return sum;
    }, 0);

    return result;
  }

  async getWeekly(
    ordemPagamentoAgrupadoIds: string,
    userId: number,
    endDate?: string,
  ): Promise<OrdemPagamentoSemanalDto[]> {
    const parsedEndDate = endDate ? new Date(endDate) : undefined;
    const rows = await this.agentesRepository.findWeeklyByAgrupadoIds(
      ordemPagamentoAgrupadoIds,
      userId,
      parsedEndDate,
    );

    return rows.map((row) => {
      const dto = new OrdemPagamentoSemanalDto();
      dto.dataCaptura = row.dataCaptura as any;
      dto.valor = Number(row.valor || 0);
      dto.ids = row.ids;
      return dto;
    });
  }

  getDaily(
    ordemPagamentoIds: string,
    userId: number,
  ): Promise<Record<string, unknown>[]> {
    return this.agentesRepository.findDailyByOrdemIds(
      ordemPagamentoIds,
      userId,
    );
  }

  async getPreviousDays(
    ordemPagamentoAgrupadoIds: string,
    userId: number,
  ): Promise<OrdemPagamentoSemanalDto[]> {
    const rows =
      await this.agentesRepository.findPreviousDaysByAgrupadoIds(
        ordemPagamentoAgrupadoIds,
        userId,
      );

    return rows.map((row) => {
      const dto = new OrdemPagamentoSemanalDto();
      dto.valor = Number(row.valor || 0);
      dto.dataOrdem = row.dataOrdem as any;
      dto.dataCaptura = row.dataCaptura as any;
      return dto;
    });
  }

  async getDashboard(query: AgentesDashboardQueryDto, request: IRequest) {
    const targetUserId = this.resolveTargetUserId(query.userId, request);
    this.validateSelectedDates(query);
    const dashboardQuery: DashboardDataQuery = {
      month: query.month,
      userId: targetUserId,
      paymentDate: query.paymentDate,
      workDate: query.workDate,
    };
    const dashboardData = await this.agentesRepository.findDashboardData(dashboardQuery);

    const availableMonths = await this.agentesRepository.getAvailableMonths(targetUserId);
    const associacoes = await this.agentesRepository.getAgentAssociationOptions(targetUserId);
    const baseData: DashboardMonthData = dashboardData ?? {
      month: query.month,
      paymentCycles: [],
    };
    const monthlyPayments = baseData.paymentCycles.map((paymentCycle) => this.buildMonthlyPaymentSummary(paymentCycle));
    const selectedPaymentCycle = query.paymentDate ? baseData.paymentCycles.find((paymentCycle) => paymentCycle.paymentDate === query.paymentDate) ?? null : null;

    if (query.paymentDate && !selectedPaymentCycle) {
      throw new BadRequestException('The provided payment date was not found for the selected month.');
    }

    const selectedWorkDay = query.workDate ? selectedPaymentCycle?.workDays.find((workDay) => workDay.date === query.workDate) ?? null : null;

    if (query.workDate && !selectedWorkDay) {
      throw new BadRequestException('The provided work date does not belong to the selected payment cycle.');
    }

    const baseResponse: DashboardResponseBase = {
      month: baseData.month,
      associacoes,
      validPhotosCount: monthlyPayments.reduce((sum, payment) => sum + payment.validPhotosCount, 0),
      rejectedPhotosCount: monthlyPayments.reduce((sum, payment) => sum + payment.rejectedPhotosCount, 0),
      consolidatedPaymentValue: this.roundCurrency(monthlyPayments.reduce((sum, payment) => sum + payment.totalPaymentValue, 0)),
      rejectionReasons: this.buildRejectionReasons(baseData.paymentCycles),
      monthlyPayments,
    };

    return {
      userId: targetUserId,
      month: baseResponse.month,
      availableMonths,
      associacoes: baseResponse.associacoes,
      currentView: query.workDate ? 'daily' : query.paymentDate ? 'weekly' : 'monthly',
      validPhotosCount: baseResponse.validPhotosCount,
      rejectedPhotosCount: baseResponse.rejectedPhotosCount,
      rejectionReasons: baseResponse.rejectionReasons,
      consolidatedPaymentValue: baseResponse.consolidatedPaymentValue,
      monthlySummary: this.buildMonthlySummary(monthlyPayments),
      monthlyPayments: baseResponse.monthlyPayments,
      ...(selectedPaymentCycle
        ? {
          selectedPaymentWeek: {
            paymentDate: selectedPaymentCycle.paymentDate,
            paymentDayType: this.getPaymentDayType(selectedPaymentCycle.paymentDate),
            days: selectedPaymentCycle.workDays.map((workDay) => this.buildWeeklyDaySummary(workDay)),
            totalPaymentValue: this.roundCurrency(selectedPaymentCycle.workDays.reduce((sum, workDay) => sum + this.summarizePhotos(workDay.photos).totalPaymentValue, 0)),
          },
        }
        : {}),
      ...(selectedPaymentCycle && selectedWorkDay
        ? {
          selectedWorkDayPhotos: {
            paymentDate: selectedPaymentCycle.paymentDate,
            date: selectedWorkDay.date,
            periodLabel: selectedWorkDay.periodLabel,
            photos: selectedWorkDay.photos.map((photo) => ({
              id: photo.id,
              capturedAt: photo.capturedAt,
              description: photo.description,
              status: photo.status,
              amount: photo.amount,
              rejectionReason: photo.rejectionReason,
            })),
          },
        }
        : {}),
    };
  }

  private resolveTargetUserId(userId: number | undefined, request: IRequest): number {
    const loggedUserId = request.user.id;
    const targetUserId = userId ?? loggedUserId;
    const loggedRoleId = request.user.role?.id;

    if (loggedRoleId === RoleEnum.agentes && targetUserId !== loggedUserId) {
      throw new ForbiddenException('Agents can only access their own dashboard.');
    }

    return targetUserId;
  }

  private validateSelectedDates(query: AgentesDashboardQueryDto) {
    if (query.paymentDate && !query.paymentDate.startsWith(`${query.month}-`)) {
      throw new BadRequestException('The provided payment date does not belong to the selected month.');
    }

    if (query.workDate && !query.paymentDate) {
      throw new BadRequestException('A payment date must be provided when selecting a work date.');
    }
  }

  private buildMonthlyPaymentSummary(paymentCycle: DashboardPaymentCycle): DashboardMonthlyPayment {
    const workDaySummaries = paymentCycle.workDays.map((workDay) => this.buildWeeklyDaySummary(workDay));
    const paymentStatus = this.mergeStatuses(
      workDaySummaries.map((workDay) => workDay.paymentStatus),
    );

    return {
      paymentDate: paymentCycle.paymentDate,
      dataTentativaPagamento: paymentCycle.tentativePaymentDate,
      dataEfetivaPagamento: paymentCycle.effectivePaymentDate,
      paymentDayType: this.getPaymentDayType(paymentCycle.paymentDate),
      validPhotosCount: workDaySummaries.reduce((sum, workDay) => sum + workDay.validPhotosCount, 0),
      rejectedPhotosCount: workDaySummaries.reduce((sum, workDay) => sum + workDay.rejectedPhotosCount, 0),
      paymentStatus,
      pendingReason: this.resolvePendingReason(
        paymentStatus,
        paymentCycle.pendingReason,
        workDaySummaries.map((workDay) => workDay.pendingReason),
      ),
      totalPaymentValue: this.roundCurrency(workDaySummaries.reduce((sum, workDay) => sum + workDay.totalPaymentValue, 0)),
      coveredDaysCount: paymentCycle.workDays.length,
    };
  }

  private buildWeeklyDaySummary(workDay: DashboardWorkDay): DashboardWeeklyDay {
    const photoSummary = this.summarizePhotos(workDay.photos);
    const paymentStatus = photoSummary.paymentStatus;

    return {
      date: workDay.date,
      periodLabel: workDay.periodLabel,
      validPhotosCount: photoSummary.validPhotosCount,
      rejectedPhotosCount: photoSummary.rejectedPhotosCount,
      paymentStatus,
      pendingReason: this.resolvePendingReason(paymentStatus, workDay.pendingReason),
      totalPaymentValue: photoSummary.totalPaymentValue,
    };
  }

  private summarizePhotos(photos: DashboardPhotoEntry[]) {
    const validPhotosCount = photos.filter((photo) => this.normalizePaymentStatus(photo.status) === 'Pago').length;
    const rejectedPhotosCount = photos.filter((photo) => this.normalizePaymentStatus(photo.status) === 'Rejeitado').length;

    return {
      validPhotosCount,
      rejectedPhotosCount,
      paymentStatus: this.mergeStatuses(photos.map((photo) => this.normalizePaymentStatus(photo.status)).filter(Boolean)),
      totalPaymentValue: this.roundCurrency(photos.reduce((sum, photo) => sum + (Number(photo.amount) || 0), 0)),
    };
  }

  private getFirstPendingReason(reasons: Array<string | null | undefined>) {
    return reasons.find((reason) => Boolean(String(reason || '').trim())) ?? null;
  }

  private resolvePendingReason(
    status: string,
    ...reasons: Array<string | null | undefined | Array<string | null | undefined>>
  ) {
    if (!this.isPendingStatus(status)) {
      return null;
    }

    const flattenedReasons = reasons.flat();

    return this.getFirstPendingReason(flattenedReasons) ?? this.defaultPendingReason;
  }

  private isPendingStatus(status: string) {
    const normalizedStatus = String(status || '')
      .trim()
      .toLowerCase();

    return (
      normalizedStatus === 'rejeitado' ||
      normalizedStatus === 'estorno' ||
      normalizedStatus === 'aguardandopagamento' ||
      normalizedStatus === 'aguardando pagamento'
    );
  }

  private isRejectedStatus(status: string) {
    const normalizedStatus = String(status || '')
      .trim()
      .toLowerCase();

    return normalizedStatus === 'rejeitado' || normalizedStatus === 'estorno';
  }

  private buildRejectionReasons(paymentCycles: DashboardPaymentCycle[]) {
    const counts = new Map<string, number>();

    paymentCycles.forEach((paymentCycle) => {
      paymentCycle.workDays.forEach((workDay) => {
        workDay.photos.forEach((photo) => {
          if (!photo.rejectionReason || !this.isRejectedStatus(photo.status)) {
            return;
          }

          counts.set(photo.rejectionReason, (counts.get(photo.rejectionReason) ?? 0) + 1);
        });
      });
    });

    return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
  }

  private buildMonthlySummary(monthlyPayments: DashboardMonthlyPayment[]) {
    return {
      daysWithPayments: monthlyPayments.length,
      totalPayments: monthlyPayments.length,
      totalPaidEntries: monthlyPayments.filter((payment) => payment.paymentStatus === 'Pago').length,
      totalRejectedEntries: monthlyPayments.filter((payment) => payment.paymentStatus === 'Rejeitado').length,
      totalPaymentValue: this.roundCurrency(monthlyPayments.reduce((sum, payment) => sum + payment.totalPaymentValue, 0)),
    };
  }

  private mergeStatuses(statuses: string[]) {
    const normalizedStatuses = statuses.filter(Boolean);
    const uniqueStatuses = [...new Set(normalizedStatuses)];

    if (uniqueStatuses.length === 1) {
      return uniqueStatuses[0];
    }

    const hasPaid = normalizedStatuses.includes('Pago');
    const hasRejected = normalizedStatuses.includes('Rejeitado');
    const hasAwaitingPayment = normalizedStatuses.includes('Aguardando Pagamento');

    if (hasPaid && hasRejected) {
      return 'Estorno';
    }

    if (hasPaid) {
      return 'Pago';
    }

    if (hasAwaitingPayment) {
      return 'Aguardando Pagamento';
    }

    if (hasRejected) {
      return 'Rejeitado';
    }

    return 'Rejeitado';
  }

  private normalizePaymentStatus(status: string) {
    const normalizedStatus = String(status || '')
      .trim()
      .toLowerCase();

    if (normalizedStatus === 'pago') {
      return 'Pago';
    }

    if (normalizedStatus === 'rejeitado') {
      return 'Rejeitado';
    }

    if (
      normalizedStatus === 'aguardandopagamento' ||
      normalizedStatus === 'aguardando pagamento'
    ) {
      return 'Aguardando Pagamento';
    }

    return '';
  }

  private getPaymentDayType(date: string): 'terça-feira' | 'sexta-feira' | 'outro' {
    const parsedDate = new Date(`${date}T12:00:00Z`);
    const dayOfWeek = parsedDate.getUTCDay();

    if (dayOfWeek === 2) {
      return 'terça-feira';
    }

    if (dayOfWeek === 5) {
      return 'sexta-feira';
    }

    return 'outro';
  }

  private roundCurrency(value: number) {
    return Number(value.toFixed(2));
  }
}
