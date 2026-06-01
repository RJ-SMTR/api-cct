import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';

type DashboardPaymentEntry = {
  id: string;
  date: string;
  description: string;
  status: string;
  amount: number;
  rejectionReason: string | null;
};

type DashboardDay = {
  date: string;
  validPhotosCount: number;
  rejectedPhotosCount: number;
  paymentStatus: string;
  totalPaymentValue: number;
  payments: DashboardPaymentEntry[];
};

type DashboardMonthData = {
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
export class AgentesRepository {
  private readonly dashboardMockData: Record<string, DashboardMonthData> = {
    '2026-05': {
      month: '2026-05',
      validPhotosCount: 186,
      rejectedPhotosCount: 29,
      consolidatedPaymentValue: 186,
      rejectionReasons: [
        { reason: 'Documento ilegível', count: 12 },
        { reason: 'Foto fora do padrão', count: 9 },
        { reason: 'Dado inconsistente', count: 5 },
        { reason: 'Duplicidade', count: 3 },
      ],
      dailyPayments: [
        {
          date: '2026-05-03',
          validPhotosCount: 18,
          rejectedPhotosCount: 4,
          paymentStatus: 'Pago parcialmente',
          totalPaymentValue: 18,
          payments: [
            {
              id: 'PAG-0503-01',
              date: '2026-05-03',
              description: 'Repasse manhã',
              status: 'Pago',
              amount: 9,
              rejectionReason: null,
            },
            {
              id: 'PAG-0503-02',
              date: '2026-05-03',
              description: 'Repasse tarde',
              status: 'Pago',
              amount: 9,
              rejectionReason: null,
            },
            {
              id: 'PAG-0503-03',
              date: '2026-05-03',
              description: 'Ajuste operacional',
              status: 'Rejeitado',
              amount: 0,
              rejectionReason: 'Documento ilegível',
            },
          ],
        },
        {
          date: '2026-05-11',
          validPhotosCount: 24,
          rejectedPhotosCount: 3,
          paymentStatus: 'Pago parcialmente',
          totalPaymentValue: 24,
          payments: [
            {
              id: 'PAG-0511-01',
              date: '2026-05-11',
              description: 'Repasse integral',
              status: 'Pago',
              amount: 12,
              rejectionReason: null,
            },
            {
              id: 'PAG-0511-02',
              date: '2026-05-11',
              description: 'Complemento',
              status: 'Pago',
              amount: 12,
              rejectionReason: null,
            },
            {
              id: 'PAG-0511-03',
              date: '2026-05-11',
              description: 'Conferência manual',
              status: 'Rejeitado',
              amount: 0,
              rejectionReason: 'Dado inconsistente',
            },
          ],
        },
        {
          date: '2026-05-19',
          validPhotosCount: 31,
          rejectedPhotosCount: 5,
          paymentStatus: 'Pago parcialmente',
          totalPaymentValue: 31,
          payments: [
            {
              id: 'PAG-0519-01',
              date: '2026-05-19',
              description: 'Repasse início de semana',
              status: 'Pago',
              amount: 15,
              rejectionReason: null,
            },
            {
              id: 'PAG-0519-02',
              date: '2026-05-19',
              description: 'Repasse fim de semana',
              status: 'Pago',
              amount: 16,
              rejectionReason: null,
            },
            {
              id: 'PAG-0519-03',
              date: '2026-05-19',
              description: 'Reprocessamento',
              status: 'Rejeitado',
              amount: 0,
              rejectionReason: 'Duplicidade',
            },
          ],
        },
        {
          date: '2026-05-25',
          validPhotosCount: 20,
          rejectedPhotosCount: 2,
          paymentStatus: 'Pago',
          totalPaymentValue: 20,
          payments: [
            {
              id: 'PAG-0525-01',
              date: '2026-05-25',
              description: 'Repasse consolidado',
              status: 'Pago',
              amount: 10,
              rejectionReason: null,
            },
            {
              id: 'PAG-0525-02',
              date: '2026-05-25',
              description: 'Complemento operacional',
              status: 'Pago',
              amount: 10,
              rejectionReason: null,
            },
          ],
        },
      ],
    },
    '2026-04': {
      month: '2026-04',
      validPhotosCount: 154,
      rejectedPhotosCount: 21,
      consolidatedPaymentValue: 154,
      rejectionReasons: [
        { reason: 'Documento ilegível', count: 8 },
        { reason: 'Foto fora do padrão', count: 6 },
        { reason: 'Dado inconsistente', count: 4 },
        { reason: 'Cadastro incompleto', count: 3 },
      ],
      dailyPayments: [
        {
          date: '2026-04-08',
          validPhotosCount: 21,
          rejectedPhotosCount: 3,
          paymentStatus: 'Pago',
          totalPaymentValue: 21,
          payments: [
            {
              id: 'PAG-0408-01',
              date: '2026-04-08',
              description: 'Repasse semanal',
              status: 'Pago',
              amount: 10,
              rejectionReason: null,
            },
            {
              id: 'PAG-0408-02',
              date: '2026-04-08',
              description: 'Complemento',
              status: 'Pago',
              amount: 11,
              rejectionReason: null,
            },
          ],
        },
        {
          date: '2026-04-16',
          validPhotosCount: 27,
          rejectedPhotosCount: 4,
          paymentStatus: 'Pago parcialmente',
          totalPaymentValue: 27,
          payments: [
            {
              id: 'PAG-0416-01',
              date: '2026-04-16',
              description: 'Repasse quinzena',
              status: 'Pago',
              amount: 13,
              rejectionReason: null,
            },
            {
              id: 'PAG-0416-02',
              date: '2026-04-16',
              description: 'Complemento quinzena',
              status: 'Pago',
              amount: 14,
              rejectionReason: null,
            },
            {
              id: 'PAG-0416-03',
              date: '2026-04-16',
              description: 'Validação manual',
              status: 'Rejeitado',
              amount: 0,
              rejectionReason: 'Cadastro incompleto',
            },
          ],
        },
        {
          date: '2026-04-28',
          validPhotosCount: 19,
          rejectedPhotosCount: 2,
          paymentStatus: 'Pago',
          totalPaymentValue: 19,
          payments: [
            {
              id: 'PAG-0428-01',
              date: '2026-04-28',
              description: 'Repasse fechamento',
              status: 'Pago',
              amount: 9,
              rejectionReason: null,
            },
            {
              id: 'PAG-0428-02',
              date: '2026-04-28',
              description: 'Complemento fechamento',
              status: 'Pago',
              amount: 10,
              rejectionReason: null,
            },
          ],
        },
      ],
    },
  };

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  async findAgentUsers(): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.status', 'status')
      .where('user."statusId" = :statusId', { statusId: 3 })
      .orderBy('user."fullName"', 'ASC')
      .getMany();
  }

  async findDashboardData(month: string): Promise<DashboardMonthData | null> {
    return this.dashboardMockData[month] ?? null;
  }

  getAvailableMonths(): string[] {
    return Object.keys(this.dashboardMockData).sort();
  }
}
