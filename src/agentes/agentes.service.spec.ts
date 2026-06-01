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

  it('should return selectedDayPayments when date is provided', async () => {
    jest.spyOn(repository, 'findDashboardData').mockResolvedValue({
      month: '2026-05',
      validPhotosCount: 10,
      rejectedPhotosCount: 2,
      consolidatedPaymentValue: 123.45,
      rejectionReasons: [{ reason: 'Documento ilegível', count: 2 }],
      dailyPayments: [
        {
          date: '2026-05-10',
          validPhotosCount: 5,
          rejectedPhotosCount: 1,
          paymentStatus: 'Pago',
          totalPaymentValue: 100,
          payments: [
            {
              id: 'PAY-1',
              date: '2026-05-10',
              description: 'Pagamento teste',
              status: 'Pago',
              amount: 100,
              rejectionReason: null,
            },
          ],
        },
      ],
    } as any);
    jest.spyOn(repository, 'getAvailableMonths').mockReturnValue(['2026-05']);

    const response = await service.getDashboard(
      {
        month: '2026-05',
        date: '2026-05-10',
        userId: 10,
      },
      {
        user: {
          id: 1,
          role: new Role(RoleEnum.admin),
        },
      } as any,
    );

    expect(response.selectedDayPayments).toEqual([
      {
        id: 'PAY-1',
        date: '2026-05-10',
        description: 'Pagamento teste',
        status: 'Pago',
        amount: 100,
        rejectionReason: null,
      },
    ]);
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
