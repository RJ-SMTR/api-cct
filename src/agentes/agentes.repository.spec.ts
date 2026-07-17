import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { AgentesRepository } from './agentes.repository';

describe('AgentesRepository', () => {
  let repository: AgentesRepository;
  let typeormRepository: Pick<Repository<User>, 'createQueryBuilder'>;
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

    repository = new AgentesRepository(typeormRepository as Repository<User>);
  });

  it('should build an agent users query using TypeORM property paths', async () => {
    await repository.findAgentUsers();

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.where).toHaveBeenCalledWith('"user"."roleId" = :roleId', {
      roleId: 3,
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('"user"."fullName"', 'ASC');
  });

  it('should normalize mock association values into at most two options', () => {
    expect(repository.getAgentAssociationOptions(123)).toEqual([
      { value: 0, label: 'Flamengo' },
      { value: 1, label: 'Lagoa' },
    ]);
  });

  it('should zero all mocked dashboard amounts before returning data', async () => {
    const dashboardData = await repository.findDashboardData('2026-05');

    expect(dashboardData).not.toBeNull();

    const amounts = dashboardData!.paymentCycles.flatMap((paymentCycle) =>
      paymentCycle.workDays.flatMap((workDay) =>
        workDay.photos.map((photo) => photo.amount),
      ),
    );

    expect(amounts.length).toBeGreaterThan(0);
    expect(amounts.every((amount) => amount === 0)).toBe(true);
  });
});
