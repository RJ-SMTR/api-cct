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
    expect(queryBuilder.where).toHaveBeenCalledWith('user.statusId = :statusId', {
      statusId: 3,
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.fullName', 'ASC');
  });
});
