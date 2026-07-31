import { DataSource, Repository } from 'typeorm';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { User } from 'src/users/entities/user.entity';
import { AgentesRepository } from './agentes.repository';
import { RoleEnum } from 'src/roles/roles.enum';

describe('AgentesRepository', () => {
  let repository: AgentesRepository;
  let typeormRepository: Pick<Repository<User>, 'createQueryBuilder'>;
  let mailHistoryService: Pick<MailHistoryService, 'find'>;
  let dataSource: Pick<DataSource, 'query'>;
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(() => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    typeormRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    mailHistoryService = {
      find: jest.fn().mockResolvedValue([]),
    };
    dataSource = {
      query: jest.fn(),
    };

    repository = new AgentesRepository(
      typeormRepository as Repository<User>,
      mailHistoryService as MailHistoryService,
      dataSource as DataSource,
    );
  });

  it('should build an agent users query using TypeORM property paths', async () => {
    await repository.findAgentUsers();

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.where).toHaveBeenCalledWith('"user"."roleId" = :roleId', {
      roleId: RoleEnum.agentes,
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('"user"."fullName"', 'ASC');
  });

  it('should map real associations from the loaded user relationships', () => {
    const association = new User({
      id: 10,
      fullName: 'MUNICIPIO DE RIO DE JANEIRO',
      cpfCnpj: '42498733000148',
    });
    const agent = new User({
      id: 20,
      following: [
        {
          userId: 20,
          relatedUserId: 10,
          relatedUser: association,
        } as any,
      ],
    });

    expect(repository.getAgentAssociationOptionsFromUser(agent)).toEqual([
      {
        value: 10,
        label: 'MUNICIPIO DE RIO DE JANEIRO',
        cpfCnpj: '42498733000148',
      },
    ]);
  });

  it('should map invite sentAt into inviteAt for agent users', async () => {
    const sentAt = new Date('2026-06-08T10:15:00.000Z');
    const user = new User({ id: 7, email: 'agent@test.com' });
    const mailHistory = new MailHistory({
      user,
      sentAt,
      hash: 'agent_invite_hash',
      inviteStatus: new InviteStatus(InviteStatusEnum.sent),
    });

    queryBuilder.getMany.mockResolvedValue([user]);
    jest.spyOn(mailHistoryService, 'find').mockResolvedValue([mailHistory]);

    const result = await repository.findAgentUsers();

    expect(mailHistoryService.find).toHaveBeenCalledWith({
      user: { id: expect.any(Object) },
    });
    expect(result[0].aux_inviteStatus?.id).toBe(InviteStatusEnum.sent);
    expect(result[0].inviteAt).toEqual(sentAt);
    expect(result[0].aux_inviteHash).toBe('agent_invite_hash');
    expect(result[0].mailHistories).toEqual([mailHistory]);
  });

  it('should build dashboard data from monthly, weekly and daily query rows', async () => {
    jest
      .spyOn(dataSource, 'query')
      .mockResolvedValueOnce([
        {
          paymentDate: '2026-05-12',
          statusRemessa: 3,
          motivoStatusRemessa: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          paymentDate: '2026-05-12',
          workDate: '2026-05-11',
          statusRemessa: 3,
          motivoStatusRemessa: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          photoId: 'GUARDADOR-1',
          paymentDate: '2026-05-12',
          workDate: '2026-05-11',
          description: 'Repasse do guardador #100',
          amount: '15.50',
          statusRemessa: 3,
          motivoStatusRemessa: null,
        },
      ]);

    const dashboardData = await repository.findDashboardData({
      month: '2026-05',
      userId: 7,
    });

    expect(dashboardData).toEqual(
      {
        month: '2026-05',
        paymentCycles: [
          {
            paymentDate: '2026-05-12',
            pendingReason: null,
            workDays: [
              {
                date: '2026-05-11',
                periodLabel: 'Integral',
                pendingReason: null,
                photos: [
                  {
                    id: 'GUARDADOR-1',
                    capturedAt: '2026-05-11T12:00:00.000Z',
                    description: 'Repasse do guardador #100',
                    status: 'Pago',
                    amount: 15.5,
                    rejectionReason: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    );
    expect(dataSource.query).toHaveBeenCalledTimes(3);
  });

  it('should preserve aguardando pagamento status in dashboard data', async () => {
    jest
      .spyOn(dataSource, 'query')
      .mockResolvedValueOnce([
        {
          paymentDate: '2026-05-16',
          statusRemessa: 2,
          motivoStatusRemessa: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          paymentDate: '2026-05-16',
          workDate: '2026-05-15',
          statusRemessa: 2,
          motivoStatusRemessa: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          photoId: 'GUARDADOR-2',
          paymentDate: '2026-05-16',
          workDate: '2026-05-15',
          description: 'Repasse do guardador #101',
          amount: '22.10',
          statusRemessa: 2,
          motivoStatusRemessa: null,
        },
      ]);

    const dashboardData = await repository.findDashboardData({
      month: '2026-05',
      userId: 7,
    });

    expect(dashboardData).toEqual({
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
  });

  it('should return available months from persisted dashboard data', async () => {
    jest.spyOn(dataSource, 'query').mockResolvedValue([
      { month: '2026-06' },
      { month: '2026-05' },
    ]);

    await expect(repository.getAvailableMonths(7)).resolves.toEqual([
      '2026-06',
      '2026-05',
    ]);
  });
});
