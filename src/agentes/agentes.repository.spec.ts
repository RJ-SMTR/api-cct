import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { AgentesRepository } from './agentes.repository';
import { RoleEnum } from 'src/roles/roles.enum';

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

  it('should remove mocked dashboard details before returning data', async () => {
    const dashboardData = await repository.findDashboardData('2026-05');

    expect(dashboardData).toEqual({
      month: '2026-05',
      paymentCycles: [],
    });
  });
});
