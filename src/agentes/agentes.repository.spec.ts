import { Repository } from 'typeorm';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { User } from 'src/users/entities/user.entity';
import { AgentesRepository } from './agentes.repository';

describe('AgentesRepository', () => {
  let repository: AgentesRepository;
  let typeormRepository: Pick<Repository<User>, 'createQueryBuilder'>;
  let mailHistoryService: Pick<MailHistoryService, 'find'>;
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

    repository = new AgentesRepository(
      typeormRepository as Repository<User>,
      mailHistoryService as MailHistoryService,
    );
  });

  it('should build an agent users query using TypeORM property paths', async () => {
    await repository.findAgentUsers();

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.where).toHaveBeenCalledWith('"user"."roleId" = :roleId', {
      roleId: 3,
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('"user"."fullName"', 'ASC');
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

  it('should return no mock associations', () => {
    expect(repository.getAgentAssociationOptions(123)).toEqual([]);
  });

  it('should remove mocked dashboard details before returning data', async () => {
    const dashboardData = await repository.findDashboardData('2026-05');

    expect(dashboardData).toEqual({
      month: '2026-05',
      paymentCycles: [],
    });
  });
});
