import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { RoleEnum } from 'src/roles/roles.enum';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { AgentesDashboardQueryDto } from './dtos/agentes-dashboard-query.dto';
import { AgentesRepository } from './agentes.repository';

type DashboardDay = {
  date: string;
  validPhotosCount: number;
  rejectedPhotosCount: number;
  paymentStatus: string;
  totalPaymentValue: number;
  payments: Array<{
    id: string;
    date: string;
    description: string;
    status: string;
    amount: number;
    rejectionReason: string | null;
  }>;
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
  dailyPayments: DashboardDay[];
};

@Injectable()
export class AgentesService {
  private readonly agentStatusId = 3;

  constructor(private readonly agentesRepository: AgentesRepository) { }

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

    if (query.date && !query.date.startsWith(`${query.month}-`)) {
      throw new BadRequestException('The provided date does not belong to the selected month.');
    }

    const availableMonths = this.agentesRepository.getAvailableMonths();
    const baseData: DashboardResponseBase = dashboardData ?? {
      month: query.month,
      validPhotosCount: 0,
      rejectedPhotosCount: 0,
      consolidatedPaymentValue: 0,
      rejectionReasons: [],
      dailyPayments: [],
    };

    const dailyPayments: DashboardDay[] = Array.isArray(baseData.dailyPayments)
      ? [...baseData.dailyPayments]
      : [];
    const selectedDay = query.date
      ? dailyPayments.find((day) => day.date === query.date) ?? null
      : null;

    return {
      userId: targetUserId,
      month: baseData.month,
      availableMonths,
      validPhotosCount: baseData.validPhotosCount,
      rejectedPhotosCount: baseData.rejectedPhotosCount,
      rejectionReasons: baseData.rejectionReasons,
      consolidatedPaymentValue: baseData.consolidatedPaymentValue,
      monthlySummary: this.buildMonthlySummary(dailyPayments),
      dailyPayments,
      ...(query.date
        ? {
          selectedDayPayments: selectedDay?.payments ?? [],
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

  private buildMonthlySummary(dailyPayments: DashboardDay[]) {
    return {
      daysWithPayments: dailyPayments.length,
      totalPayments: dailyPayments.reduce((sum, day) => sum + day.payments.length, 0),
      totalPaidEntries: dailyPayments.reduce(
        (sum, day) => sum + day.payments.filter((payment) => payment.status === 'Pago').length,
        0,
      ),
      totalRejectedEntries: dailyPayments.reduce(
        (sum, day) => sum + day.payments.filter((payment) => payment.status === 'Rejeitado').length,
        0,
      ),
      totalPaymentValue: Number(
        dailyPayments.reduce((sum, day) => sum + day.totalPaymentValue, 0).toFixed(2),
      ),
    };
  }
}
