import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { AgentesRepository } from './agentes.repository';
import { AgentesService } from './agentes.service';

describe('AgentesService', () => {
  let service: AgentesService;
  let repository: AgentesRepository;

  const repositoryMock = {
    provide: AgentesRepository,
    useValue: {
      findAgentUsers: jest.fn(),
      findDashboardData: jest.fn(),
      getAvailableMonths: jest.fn(),
    },
  } as Provider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentesService, repositoryMock],
    }).compile();

    service = module.get(AgentesService);
    repository = module.get(AgentesRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return weekly days for a selected tuesday payment date', async () => {
    jest.spyOn(repository, 'findDashboardData').mockResolvedValue({
      month: '2026-05',
      paymentCycles: [
        {
          paymentDate: '2026-05-05',
          workDays: [
            {
              date: '2026-05-01',
              periodLabel: 'Tarde',
              photos: [
                {
                  id: 'PHOTO-1',
                  capturedAt: '2026-05-01T14:00:00',
                  description: 'Foto de sexta-feira',
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
                  id: 'PHOTO-2',
                  capturedAt: '2026-05-02T10:00:00',
                  description: 'Foto de sábado',
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
                  id: 'PHOTO-3',
                  capturedAt: '2026-05-03T10:00:00',
                  description: 'Foto de domingo',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
              ],
            },
            {
              date: '2026-05-04',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-4',
                  capturedAt: '2026-05-04T10:00:00',
                  description: 'Foto de segunda',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Documento ilegível',
                },
              ],
            },
          ],
        },
      ],
    } as any);
    jest.spyOn(repository, 'getAvailableMonths').mockReturnValue(['2026-05']);

    const response = await service.getDashboard(
      {
        month: '2026-05',
        paymentDate: '2026-05-05',
        userId: 10,
      },
      {
        user: {
          id: 1,
          role: new Role(RoleEnum.admin),
        },
      } as any,
    );

    expect(response.currentView).toBe('weekly');
    expect(response.selectedPaymentWeek.paymentDayType).toBe('terça-feira');
    expect(response.selectedPaymentWeek.days.map((day) => day.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04']);
  });

  it('should return daily photos when a work date is selected', async () => {
    jest.spyOn(repository, 'findDashboardData').mockResolvedValue({
      month: '2026-05',
      paymentCycles: [
        {
          paymentDate: '2026-05-08',
          workDays: [
            {
              date: '2026-05-06',
              periodLabel: 'Integral',
              photos: [
                {
                  id: 'PHOTO-10',
                  capturedAt: '2026-05-06T09:00:00',
                  description: 'Foto da quarta-feira',
                  status: 'Pago',
                  amount: 1,
                  rejectionReason: null,
                },
                {
                  id: 'PHOTO-11',
                  capturedAt: '2026-05-06T13:00:00',
                  description: 'Foto rejeitada',
                  status: 'Rejeitado',
                  amount: 0,
                  rejectionReason: 'Foto fora do padrão',
                },
              ],
            },
          ],
        },
      ],
    } as any);
    jest.spyOn(repository, 'getAvailableMonths').mockReturnValue(['2026-05']);

    const response = await service.getDashboard(
      {
        month: '2026-05',
        paymentDate: '2026-05-08',
        workDate: '2026-05-06',
        userId: 10,
      },
      {
        user: {
          id: 1,
          role: new Role(RoleEnum.admin),
        },
      } as any,
    );

    expect(response.currentView).toBe('daily');
    expect(response.selectedWorkDayPhotos).toEqual({
      paymentDate: '2026-05-08',
      date: '2026-05-06',
      periodLabel: 'Integral',
      photos: [
        {
          id: 'PHOTO-10',
          capturedAt: '2026-05-06T09:00:00',
          description: 'Foto da quarta-feira',
          status: 'Pago',
          amount: 1,
          rejectionReason: null,
        },
        {
          id: 'PHOTO-11',
          capturedAt: '2026-05-06T13:00:00',
          description: 'Foto rejeitada',
          status: 'Rejeitado',
          amount: 0,
          rejectionReason: 'Foto fora do padrão',
        },
      ],
    });
  });

  it('should prevent agents from accessing another user dashboard', async () => {
    await expect(
      service.getDashboard(
        {
          month: '2026-05',
          userId: 99,
        },
        {
          user: {
            id: 1,
            role: new Role(RoleEnum.agents),
          },
        } as any,
      ),
    ).rejects.toThrow('Agents can only access their own dashboard.');
  });
});
