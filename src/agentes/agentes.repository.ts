import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';

export type DashboardPhotoEntry = {
  id: string;
  capturedAt: string;
  description: string;
  status: string;
  amount: number;
  rejectionReason: string | null;
};

export type DashboardWorkDay = {
  date: string;
  periodLabel: string;
  photos: DashboardPhotoEntry[];
};

export type DashboardPaymentCycle = {
  paymentDate: string;
  workDays: DashboardWorkDay[];
};

export type DashboardMonthData = {
  month: string;
  paymentCycles: DashboardPaymentCycle[];
};

@Injectable()
export class AgentesRepository {
  private readonly dashboardMockData: Record<string, DashboardMonthData> = {
    '2026-05': {
      month: '2026-05',
      paymentCycles: [
        {
          paymentDate: '2026-05-01',
          workDays: [
            {
              date: '2026-04-29',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260429-01',
                  capturedAt: '2026-04-29T09:15:00',
                  description: 'Foto de fachada',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260429-02',
                  capturedAt: '2026-04-29T11:40:00',
                  description: 'Documento complementar',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260429-03',
                  capturedAt: '2026-04-29T16:05:00',
                  description: 'Comprovante ilegível',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Documento ilegível',
                },
              ],
            },
            {
              date: '2026-04-30',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260430-01',
                  capturedAt: '2026-04-30T08:20:00',
                  description: 'Foto de painel',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260430-02',
                  capturedAt: '2026-04-30T10:45:00',
                  description: 'Selfie do local',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260430-03',
                  capturedAt: '2026-04-30T14:30:00',
                  description: 'Foto duplicada',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Duplicidade',
                },
              ],
            },
            {
              date: '2026-05-01',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260501-01',
                  capturedAt: '2026-05-01T09:05:00',
                  description: 'Foto do atendimento',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260501-02',
                  capturedAt: '2026-05-01T12:10:00',
                  description: 'Documento validado',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260501-03',
                  capturedAt: '2026-05-01T17:20:00',
                  description: 'Campo inconsistente',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Dado inconsistente',
                },
              ],
            },
          ],
        },
        {
          paymentDate: '2026-05-05',
          workDays: [
            {
              date: '2026-05-01',
              periodLabel: 'Tarde',
              photos: [
                {
                  id: 'PHOTO-20260501-TARDE-01',
                  capturedAt: '2026-05-01T14:10:00',
                  description: 'Foto da vitrine',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260501-TARDE-02',
                  capturedAt: '2026-05-01T15:35:00',
                  description: 'Documento da tarde',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-05-02',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260502-01',
                  capturedAt: '2026-05-02T09:00:00',
                  description: 'Foto do sábado',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260502-02',
                  capturedAt: '2026-05-02T11:50:00',
                  description: 'Foto fora do padrão',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Foto fora do padrão',
                },
                {
                  id: 'PHOTO-20260502-03',
                  capturedAt: '2026-05-02T16:45:00',
                  description: 'Cadastro confirmado',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-05-03',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260503-01',
                  capturedAt: '2026-05-03T10:30:00',
                  description: 'Foto do domingo',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260503-02',
                  capturedAt: '2026-05-03T17:00:00',
                  description: 'Comprovante cortado',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Foto fora do padrão',
                },
              ],
            },
            {
              date: '2026-05-04',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260504-01',
                  capturedAt: '2026-05-04T08:45:00',
                  description: 'Foto de abertura',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260504-02',
                  capturedAt: '2026-05-04T13:05:00',
                  description: 'Documento assinado',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
          ],
        },
        {
          paymentDate: '2026-05-08',
          workDays: [
            {
              date: '2026-05-06',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260506-01',
                  capturedAt: '2026-05-06T09:10:00',
                  description: 'Foto da quarta-feira',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260506-02',
                  capturedAt: '2026-05-06T11:20:00',
                  description: 'Comprovante de visita',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-05-07',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260507-01',
                  capturedAt: '2026-05-07T08:35:00',
                  description: 'Checklist concluído',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260507-02',
                  capturedAt: '2026-05-07T15:55:00',
                  description: 'Documento em baixa qualidade',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Documento ilegível',
                },
              ],
            },
            {
              date: '2026-05-08',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260508-01',
                  capturedAt: '2026-05-08T09:25:00',
                  description: 'Foto do caixa',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260508-02',
                  capturedAt: '2026-05-08T11:15:00',
                  description: 'Registro complementar',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260508-03',
                  capturedAt: '2026-05-08T16:45:00',
                  description: 'Foto sem enquadramento',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Foto fora do padrão',
                },
              ],
            },
          ],
        },
        {
          paymentDate: '2026-05-12',
          workDays: [
            {
              date: '2026-05-08',
              periodLabel: 'Tarde',
              photos: [
                {
                  id: 'PHOTO-20260508-TARDE-01',
                  capturedAt: '2026-05-08T14:10:00',
                  description: 'Foto de fechamento',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260508-TARDE-02',
                  capturedAt: '2026-05-08T17:05:00',
                  description: 'Documento conferido',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-05-09',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260509-01',
                  capturedAt: '2026-05-09T09:40:00',
                  description: 'Foto do sábado',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260509-02',
                  capturedAt: '2026-05-09T10:55:00',
                  description: 'Documento duplicado',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Duplicidade',
                },
              ],
            },
            {
              date: '2026-05-10',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260510-01',
                  capturedAt: '2026-05-10T13:15:00',
                  description: 'Foto do domingo',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260510-02',
                  capturedAt: '2026-05-10T15:30:00',
                  description: 'Confirmação manual',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-05-11',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260511-01',
                  capturedAt: '2026-05-11T08:50:00',
                  description: 'Foto da segunda-feira',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260511-02',
                  capturedAt: '2026-05-11T16:20:00',
                  description: 'Campo sem assinatura',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Dado inconsistente',
                },
              ],
            },
          ],
        },
      ],
    },
    '2026-04': {
      month: '2026-04',
      paymentCycles: [
        {
          paymentDate: '2026-04-17',
          workDays: [
            {
              date: '2026-04-15',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260415-01',
                  capturedAt: '2026-04-15T09:00:00',
                  description: 'Foto da quarta-feira',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260415-02',
                  capturedAt: '2026-04-15T14:35:00',
                  description: 'Documento incompleto',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Cadastro incompleto',
                },
              ],
            },
            {
              date: '2026-04-16',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260416-01',
                  capturedAt: '2026-04-16T08:40:00',
                  description: 'Foto do balcão',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260416-02',
                  capturedAt: '2026-04-16T12:15:00',
                  description: 'Foto da equipe',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-04-17',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260417-01',
                  capturedAt: '2026-04-17T10:05:00',
                  description: 'Registro financeiro',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260417-02',
                  capturedAt: '2026-04-17T16:40:00',
                  description: 'Documento fora do padrão',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Foto fora do padrão',
                },
              ],
            },
          ],
        },
        {
          paymentDate: '2026-04-21',
          workDays: [
            {
              date: '2026-04-17',
              periodLabel: 'Tarde',
              photos: [
                {
                  id: 'PHOTO-20260417-TARDE-01',
                  capturedAt: '2026-04-17T14:15:00',
                  description: 'Foto da tarde',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-04-18',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260418-01',
                  capturedAt: '2026-04-18T09:50:00',
                  description: 'Foto do sábado',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-04-19',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260419-01',
                  capturedAt: '2026-04-19T10:10:00',
                  description: 'Foto do domingo',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-04-20',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260420-01',
                  capturedAt: '2026-04-20T08:25:00',
                  description: 'Foto da segunda-feira',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260420-02',
                  capturedAt: '2026-04-20T15:20:00',
                  description: 'Documento inválido',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Documento ilegível',
                },
              ],
            },
          ],
        },
        {
          paymentDate: '2026-04-24',
          workDays: [
            {
              date: '2026-04-22',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260422-01',
                  capturedAt: '2026-04-22T09:15:00',
                  description: 'Foto da quarta-feira',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-04-23',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260423-01',
                  capturedAt: '2026-04-23T13:05:00',
                  description: 'Foto da quinta-feira',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260423-02',
                  capturedAt: '2026-04-23T17:10:00',
                  description: 'Foto inconsistente',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Dado inconsistente',
                },
              ],
            },
            {
              date: '2026-04-24',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-20260424-01',
                  capturedAt: '2026-04-24T09:35:00',
                  description: 'Foto de fechamento',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-20260424-02',
                  capturedAt: '2026-04-24T11:50:00',
                  description: 'Documento final',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
          ],
        },
      ],
    },
  };

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAgentUsers(): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.status', 'status')
      .where('user.statusId = :statusId', { statusId: 3 })
      .orderBy('user.fullName', 'ASC')
      .getMany();
  }

  async findDashboardData(month: string): Promise<DashboardMonthData | null> {
    return this.dashboardMockData[month] ?? null;
  }

  getAvailableMonths(): string[] {
    return Object.keys(this.dashboardMockData).sort();
  }
}
