import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { RoleEnum } from 'src/roles/roles.enum';
import { User } from 'src/users/entities/user.entity';
import { AgentesRepository } from './agentes.repository';
import { AgentesService } from './agentes.service';

describe('AgentesService', () => {
  let service: AgentesService;
  let agentesRepository: Pick<AgentesRepository, 'findAgentUsers' | 'getAgentAssociationOptions'>;

  beforeEach(() => {
    agentesRepository = {
      findAgentUsers: jest.fn(),
      getAgentAssociationOptions: jest.fn().mockReturnValue([]),
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
      .spyOn(agentesRepository, 'getAgentAssociationOptions')
      .mockReturnValue([{ value: 0, label: 'Flamengo' }]);

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
        associacoes: [{ value: 0, label: 'Flamengo' }],
        updatedAt,
      },
    ]);
  });
});
