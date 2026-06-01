import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { RoleEnum } from 'src/roles/roles.enum';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { AgentesDashboardQueryDto } from './dtos/agentes-dashboard-query.dto';
import { AgentesRepository, DashboardMonthData, DashboardPaymentCycle, DashboardPhotoEntry, DashboardWorkDay } from './agentes.repository';

type DashboardMonthlyPayment = {
  paymentDate: string;
  paymentDayType: 'terça-feira' | 'sexta-feira' | 'outro';
  validPhotosCount: number;
  rejectedPhotosCount: number;
  paymentStatus: string;
  totalPaymentValue: number;
  coveredDaysCount: number;
};

type DashboardWeeklyDay = {
  date: string;
  periodLabel: string;
  validPhotosCount: number;
  rejectedPhotosCount: number;
  paymentStatus: string;
  totalPaymentValue: number;
};

type DashboardResponseBase = {
  month: string;
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
  private readonly agentStatusId = 3;

  constructor(private readonly agentesRepository: AgentesRepository) {}

  async getAgentUsers() {
    const users = await this.agentesRepository.findAgentUsers();

    return users
      .filter((user) => user.status?.id === this.agentStatusId)
      .map((user) => ({
        id: user.id,
        fullName: user.fullName ?? null,
        email: user.email ?? null,
        permitCode: user.permitCode ?? null,
        cpfCnpj: user.cpfCnpj ?? null,
        phone: user.phone ?? null,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
            }
          : null,
        status: user.status
          ? {
              id: user.status.id,
              name: user.status.name,
            }
          : null,
        updatedAt: user.updatedAt,
      }));
  }

  async getDashboard(query: AgentesDashboardQueryDto, request: IRequest) {
    const targetUserId = this.resolveTargetUserId(query.userId, request);
    const dashboardData = await this.agentesRepository.findDashboardData(query.month);

    this.validateSelectedDates(query);

    const availableMonths = this.agentesRepository.getAvailableMonths();
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

    if (loggedRoleId === RoleEnum.agents && targetUserId !== loggedUserId) {
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

    return {
      paymentDate: paymentCycle.paymentDate,
      paymentDayType: this.getPaymentDayType(paymentCycle.paymentDate),
      validPhotosCount: workDaySummaries.reduce((sum, workDay) => sum + workDay.validPhotosCount, 0),
      rejectedPhotosCount: workDaySummaries.reduce((sum, workDay) => sum + workDay.rejectedPhotosCount, 0),
      paymentStatus: this.mergeStatuses(workDaySummaries.map((workDay) => workDay.paymentStatus)),
      totalPaymentValue: this.roundCurrency(workDaySummaries.reduce((sum, workDay) => sum + workDay.totalPaymentValue, 0)),
      coveredDaysCount: paymentCycle.workDays.length,
    };
  }

  private buildWeeklyDaySummary(workDay: DashboardWorkDay): DashboardWeeklyDay {
    const photoSummary = this.summarizePhotos(workDay.photos);

    return {
      date: workDay.date,
      periodLabel: workDay.periodLabel,
      validPhotosCount: photoSummary.validPhotosCount,
      rejectedPhotosCount: photoSummary.rejectedPhotosCount,
      paymentStatus: photoSummary.paymentStatus,
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

  private buildRejectionReasons(paymentCycles: DashboardPaymentCycle[]) {
    const counts = new Map<string, number>();

    paymentCycles.forEach((paymentCycle) => {
      paymentCycle.workDays.forEach((workDay) => {
        workDay.photos.forEach((photo) => {
          if (!photo.rejectionReason) {
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
    const hasPaid = normalizedStatuses.includes('Pago');
    const hasRejected = normalizedStatuses.includes('Rejeitado');

    if (hasPaid && hasRejected) {
      return 'Estorno';
    }

    if (hasPaid) {
      return 'Pago';
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
