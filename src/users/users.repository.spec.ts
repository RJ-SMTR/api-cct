import { EntityManager, Repository } from 'typeorm';
import { BanksService } from 'src/banks/banks.service';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let usersRepository: UsersRepository;
  let typeormRepository: Pick<Repository<User>, 'createQueryBuilder'>;
  let mailHistoryService: Pick<MailHistoryService, 'find'>;
  let banksService: Pick<BanksService, 'findMany'>;
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
    banksService = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    usersRepository = new UsersRepository(
      typeormRepository as Repository<User>,
      mailHistoryService as MailHistoryService,
      banksService as BanksService,
      {} as EntityManager,
    );

    jest.spyOn(usersRepository, 'loadLazyRelations').mockImplementation(async (users) => {
      await usersRepository['loadLazyAux_bank'](users);
      await usersRepository['loadLazyAux_invite'](users);
    });
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
    expect(queryBuilder.where).toHaveBeenCalledWith('"user"."statusId" = :statusId', {
      statusId: 3,
    });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('"user"."fullName"', 'ASC');
  });

  it('should map invite sentAt into inviteAt when loading lazy invite data', async () => {
    const sentAt = new Date('2026-06-08T10:15:00.000Z');
    const user = new User({ id: 7, email: 'user@test.com' });
    const mailHistory = new MailHistory({
      user,
      sentAt,
      hash: 'invite_hash',
      inviteStatus: new InviteStatus(InviteStatusEnum.sent),
    });

    jest.spyOn(mailHistoryService, 'find').mockResolvedValue([mailHistory]);

    await usersRepository.loadLazyRelations([user]);

    expect(mailHistoryService.find).toHaveBeenCalledWith({
      user: { id: expect.any(Object) },
    });
    expect(user.aux_inviteStatus?.id).toBe(InviteStatusEnum.sent);
    expect(user.inviteAt).toEqual(sentAt);
    expect(user.aux_inviteHash).toBe('invite_hash');
  });
});
