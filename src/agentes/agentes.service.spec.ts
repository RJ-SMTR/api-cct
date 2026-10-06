import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { RoleEnum } from 'src/roles/roles.enum';
import { User } from 'src/users/entities/user.entity';
import { AgentesRepository } from './agentes.repository';
import { AgentesService } from './agentes.service';

describe('AgentesService', () => {
  let service: AgentesService;
  let agentesRepository: Pick<
    AgentesRepository,
    | 'findAgentUsers'
    | 'getAgentAssociationOptionsFromUser'
    | 'getAgentAssociationOptions'
    | 'findDashboardData'
    | 'getAvailableMonths'
    | 'findMonthlyByUserId'
    | 'hasCompleteBankData'
  >;

  beforeEach(() => {
    agentesRepository = {
      findAgentUsers: jest.fn(),
      getAgentAssociationOptionsFromUser: jest.fn().mockReturnValue([]),
      getAgentAssociationOptions: jest.fn().mockReturnValue([]),
      findDashboardData: jest.fn(),
      getAvailableMonths: jest.fn().mockResolvedValue([]),
      findMonthlyByUserId: jest.fn().mockResolvedValue([]),
      hasCompleteBankData: jest.fn().mockResolvedValue(true),
    };

    service = new AgentesService(agentesRepository as AgentesRepository);
  });

  it('should return agent users using a DTO including invite status data', async () => {
    const updatedAt = new Date('2026-07-20T12:00:00.000Z');
    const inviteAt = new Date('2026-07-19T10:15:00.000Z');
    const user = new User({
      id: 12,
      fullName: 'Agente Teste',
      email: 'agente@test.com',
      permitCode: 'P-100',
      cpfCnpj: '12345678900',
      phone: '21999999999',
      updatedAt,
    });

    user.role = { id: RoleEnum.agentes, name: 'agentes' } as any;
    user.status = { id: 2, name: 'active' } as any;
    user.aux_inviteStatus = new InviteStatus(InviteStatusEnum.sent);
    user.inviteAt = inviteAt;

    jest.spyOn(agentesRepository, 'findAgentUsers').mockResolvedValue([user]);
    jest
      .spyOn(agentesRepository, 'getAgentAssociationOptionsFromUser')
      .mockReturnValue([{ value: 10, label: 'Flamengo', cpfCnpj: '12345678000100' }]);

    const result = await service.getAgentUsers();

    expect(result).toEqual([
      {
        id: 12,
        fullName: 'Agente Teste',
        email: 'agente@test.com',
        permitCode: 'P-100',
        cpfCnpj: '12345678900',
        phone: '21999999999',
        role: {
          id: RoleEnum.agentes,
          name: 'agentes',
        },
        status: {
          id: 2,
          name: 'active',
        },
        inviteStatus: {
          id: InviteStatusEnum.sent,
          name: 'sent',
        },
        inviteAt,
        associacoes: [{ value: 10, label: 'Flamengo', cpfCnpj: '12345678000100' }],
        updatedAt,
      },
    ]);
  });

  it('should keep aguardando pagamento in dashboard summaries without counting it as rejection', async () => {
    jest.spyOn(agentesRepository, 'findDashboardData').mockResolvedValue({
      month: '2026-05',
      paymentCycles: [
        {
          paymentDate: '2026-05-16',
          pendingReason: 'Aguardando Pagamento',
          workDays: [
            {
              date: '2026-05-15',
              periodLabel: 'Integral',
              pendingReason: 'Aguardando Pagamento',
              photos: [
                {
                  id: 'GUARDADOR-2',
                  capturedAt: '2026-05-15T12:00:00.000Z',
                  description: 'Repasse do guardador #101',
                  status: 'Aguardando Pagamento',
                  amount: 22.1,
                  rejectionReason: null,
                },
              ],
            },
          ],
        },
      ],
    });
    jest.spyOn(agentesRepository, 'getAvailableMonths').mockResolvedValue(['2026-05']);
    jest.spyOn(agentesRepository, 'getAgentAssociationOptions').mockResolvedValue([]);

    const result = await service.getDashboard(
      { month: '2026-05' } as any,
      {
        user: {
          id: 12,
          role: { id: RoleEnum.agentes },
        },
      } as any,
    );

    expect(result.monthlySummary).toEqual({
      daysWithPayments: 1,
      totalPayments: 1,
      totalPaidEntries: 0,
      totalRejectedEntries: 0,
      totalPaymentValue: 22.1,
    });
    expect(result.monthlyPayments).toEqual([
      {
        paymentDate: '2026-05-16',
        paymentDayType: 'outro',
        validPhotosCount: 0,
        rejectedPhotosCount: 0,
        paymentStatus: 'Aguardando Pagamento',
        pendingReason: 'Aguardando Pagamento',
        totalPaymentValue: 22.1,
        coveredDaysCount: 1,
      },
    ]);
    expect(result.rejectionReasons).toEqual([]);
  });

  describe('monthly error description (#1164)', () => {
    const monthlyRow = (motivoStatusRemessa: string | null) => ({
      data: '2026-10-02',
      dataTentativaPagamento: '2026-10-02',
      dataEfetivaPagamento: null,
      statusRemessa: 4,
      motivoStatusRemessa,
      ordemPagamentoAgrupadoIds: '1',
      valorTotal: '12.00',
    });

    it('explains an error without motivo code instead of returning an empty description', async () => {
      jest.spyOn(agentesRepository, 'findMonthlyByUserId').mockResolvedValue([monthlyRow(null)] as any);

      const result = await service.getMonthly('2026-10', 3039);

      expect(result.ordens[0].descricaoMotivoStatusRemessa).toBe('Motivo não informado pelo banco');
    });

    it('shows the raw code when the motivo code has no description', async () => {
      jest.spyOn(agentesRepository, 'findMonthlyByUserId').mockResolvedValue([monthlyRow('ANHO')] as any);

      const result = await service.getMonthly('2026-10', 3039);

      expect(result.ordens[0].descricaoMotivoStatusRemessa).toBe('Código ANHO');
    });

    it('keeps the OcorrenciaEnum description for a known code', async () => {
      jest.spyOn(agentesRepository, 'findMonthlyByUserId').mockResolvedValue([monthlyRow('AG')] as any);

      const result = await service.getMonthly('2026-10', 3039);

      expect(result.ordens[0].descricaoMotivoStatusRemessa).toBe('Agência/Conta corrente/DV inválido');
    });
  });

  describe('monthly bank data flag (#1164)', () => {
    const monthlyRow = {
      data: '2026-10-02',
      dataTentativaPagamento: '2026-10-02',
      dataEfetivaPagamento: null,
      statusRemessa: null,
      motivoStatusRemessa: null,
      ordemPagamentoAgrupadoIds: null,
      valorTotal: '258.80',
    };

    it('flags a monthly payment when the permissionario has no complete bank data', async () => {
      jest.spyOn(agentesRepository, 'findMonthlyByUserId').mockResolvedValue([monthlyRow] as any);
      jest.spyOn(agentesRepository, 'hasCompleteBankData').mockResolvedValue(false);

      const result = await service.getMonthly('2026-10', 3039);

      expect(result.ordens[0].dadosBancariosFaltando).toBe(true);
    });

    it('does not flag a monthly payment when bank data is complete', async () => {
      jest.spyOn(agentesRepository, 'findMonthlyByUserId').mockResolvedValue([monthlyRow] as any);
      jest.spyOn(agentesRepository, 'hasCompleteBankData').mockResolvedValue(true);

      const result = await service.getMonthly('2026-10', 3039);

      expect(result.ordens[0].dadosBancariosFaltando).toBe(false);
    });
  });
});
