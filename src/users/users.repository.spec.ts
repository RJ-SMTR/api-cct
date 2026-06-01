import { EntityManager, Repository } from 'typeorm';
import { BanksService } from 'src/banks/banks.service';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let usersRepository: UsersRepository;
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

    usersRepository = new UsersRepository(
      typeormRepository as Repository<User>,
      {} as MailHistoryService,
      {} as BanksService,
      {} as EntityManager,
    );

    jest.spyOn(usersRepository, 'loadLazyRelations').mockResolvedValue(undefined);
  });

  it('should build a normalized cpf query using a quoted user alias', async () => {
    await usersRepository.findManyByNormalizedCpf('12345678900');

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.where).toHaveBeenCalledWith(
      `regexp_replace(coalesce("user"."cpfCnpj", ''), '\\D', '', 'g') = :cpf`,
      { cpf: '12345678900' },
    );
  });

  it('should build an agent users query without manually quoted user columns', async () => {
    await usersRepository.findAgentUsersByStatus(3);

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.where).toHaveBeenCalledWith('user.statusId = :statusId', {
      statusId: 3,
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.fullName', 'ASC');
  });
});
