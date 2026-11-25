import { HttpStatus } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { BanksService } from 'src/banks/banks.service';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { validateDTO } from 'src/utils/validation-utils';

jest.mock('src/utils/validation-utils', () => ({
  validateDTO: jest.fn(),
}));

describe('UsersRepository', () => {
  let usersRepository: UsersRepository;
  let typeormRepository: Pick<Repository<User>, 'createQueryBuilder' | 'update' | 'findOne' | 'find'>;
  let mailHistoryService: Pick<MailHistoryService, 'find'>;
  let banksService: Pick<BanksService, 'findMany'>;
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    offset: jest.Mock;
    limit: jest.Mock;
    getMany: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(() => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    typeormRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      update: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
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

  describe('findManyWithPagination: deterministic order (#1198)', () => {
    it('should order the id query by fullName ASC with id ASC as tie-breaker', async () => {
      await usersRepository.findManyWithPagination({ page: 1, limit: 50 });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('"user"."fullName"', 'ASC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('"user"."id"', 'ASC');
    });

    it('should apply the same order when reloading the users by id', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 3 }, { id: 1 }, { id: 2 }], 3]);

      await usersRepository.findManyWithPagination({ page: 1, limit: 50 });

      expect(typeormRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { fullName: 'ASC', id: 'ASC' } }),
      );
    });
  });

  describe('findManyWithPagination: pagination and invite filters (#1199)', () => {
    const userWithoutBankData = (id: number) => new User({ id, fullName: `User ${id}` });

    it('should return the whole filtered list when no pagination is given (admin home contract)', async () => {
      await usersRepository.findManyWithPagination(undefined);

      expect(queryBuilder.offset).not.toHaveBeenCalled();
      expect(queryBuilder.limit).not.toHaveBeenCalled();
    });

    it('should page in the database query after ordering when pagination is given', async () => {
      await usersRepository.findManyWithPagination({ page: 3, limit: 50 });

      expect(queryBuilder.offset).toHaveBeenCalledWith(100);
      expect(queryBuilder.limit).toHaveBeenCalledWith(50);
      expect(queryBuilder.addOrderBy.mock.invocationCallOrder[0]).toBeLessThan(
        queryBuilder.offset.mock.invocationCallOrder[0],
      );
    });

    it('should return the total of the filtered set, not the size of the page', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 1 }, { id: 2 }], 120]);
      (typeormRepository.find as jest.Mock).mockResolvedValue([userWithoutBankData(1), userWithoutBankData(2)]);

      const result = await usersRepository.findManyWithPagination({ page: 1, limit: 2 });

      expect(result.total).toBe(120);
      expect(result.users.map((u) => u.id)).toEqual([1, 2]);
    });

    it('should skip the reload query when the page is empty', async () => {
      const result = await usersRepository.findManyWithPagination({ page: 9, limit: 50 });

      expect(typeormRepository.find).not.toHaveBeenCalled();
      expect(result).toEqual({ users: [], total: 0 });
    });

    it('should filter conta_bancaria_sem_senha (prov) in the query, so the page is not emptied afterwards', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 1 }, { id: 2 }], 2]);
      (typeormRepository.find as jest.Mock).mockResolvedValue([userWithoutBankData(1), userWithoutBankData(2)]);

      const result = await usersRepository.findManyWithPagination(
        { page: 1, limit: 50 },
        { inviteStatusName: 'prov' },
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('"user"."password" IS NULL'),
        expect.objectContaining({ provRoleIds: expect.any(Array) }),
      );
      expect(result.users.map((u) => u.id)).toEqual([1, 2]);
    });

    it('should filter by invite status in the query instead of loading every invite', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 5 }], 1]);
      (typeormRepository.find as jest.Mock).mockResolvedValue([userWithoutBankData(5)]);

      const result = await usersRepository.findManyWithPagination(
        { page: 1, limit: 50 },
        { inviteStatusName: 'sent' },
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('FROM "invite"'),
        { inviteStatusId: InviteStatusEnum.sent },
      );
      expect(mailHistoryService.find).not.toHaveBeenCalledWith(
        expect.objectContaining({ inviteStatus: expect.anything() }),
      );
      expect(result.users.map((u) => u.id)).toEqual([5]);
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

  it('should return an explicit duplicate-email validation message on update', async () => {
    const existingUser = new User({
      id: 10,
      email: 'current@test.com',
      mailHistories: [],
    });
    existingUser.parseNewPassword = jest.fn().mockResolvedValue(undefined) as any;

    jest.spyOn(usersRepository, 'getOne').mockResolvedValue(existingUser);
    (validateDTO as jest.Mock).mockResolvedValue({
      email: 'emailAlreadyExists',
    });

    await expect(
      usersRepository.update(10, { email: 'taken@test.com' }, 'UsersRepositorySpec.update'),
    ).rejects.toMatchObject({
      response: {
        error: 'UnprocessableEntity',
        message: 'emailAlreadyExists',
        errors: {
          email: 'emailAlreadyExists',
        },
      },
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });

    expect(validateDTO).toHaveBeenCalledWith(
      expect.any(Function),
      {
        id: 10,
        email: 'taken@test.com',
      },
      false,
    );
    expect(typeormRepository.update).not.toHaveBeenCalled();
  });

  describe('update: bankDataUpdatedAt (#1192)', () => {
    const PREVIOUS_BANK_DATA_DATE = new Date('2026-01-10T10:00:00.000Z');

    function existingUserWithBankData(overrides: Partial<User> = {}): User {
      const user = new User({
        id: 20,
        email: 'favorecido@test.com',
        phone: '21999999999',
        mailHistories: [],
        bankCode: 104,
        bankAgency: '1234',
        bankAccount: '56789',
        bankAccountDigit: '0',
        bankDataUpdatedAt: PREVIOUS_BANK_DATA_DATE,
        ...overrides,
      });
      user.parseNewPassword = jest.fn().mockResolvedValue(undefined) as any;
      return user;
    }

    async function updatePayloadFor(existingUser: User, dataToUpdate: Partial<User>): Promise<Partial<User>> {
      jest.spyOn(usersRepository, 'getOne').mockResolvedValue(existingUser);
      (validateDTO as jest.Mock).mockResolvedValue({});

      await usersRepository.update(20, dataToUpdate, 'UsersRepositorySpec.update');

      return (typeormRepository.update as jest.Mock).mock.calls[0][1];
    }

    it('should set bankDataUpdatedAt when only the bank agency changes', async () => {
      const payload = await updatePayloadFor(existingUserWithBankData(), { bankAgency: '9999' });

      expect(payload.bankDataUpdatedAt).toBeInstanceOf(Date);
      expect(payload.bankDataUpdatedAt).not.toEqual(PREVIOUS_BANK_DATA_DATE);
    });

    it.each<[string, Partial<User>, Partial<User>]>([
      ['the bank code changes', {}, { bankCode: 1 }],
      ['only the bank account changes', {}, { bankAccount: '11111' }],
      ['only the bank account digit changes', {}, { bankAccountDigit: '7' }],
      [
        'bank data is filled for the first time',
        { bankCode: undefined, bankAgency: undefined, bankAccount: undefined, bankAccountDigit: undefined, bankDataUpdatedAt: null },
        { bankCode: 104, bankAgency: '1234', bankAccount: '56789', bankAccountDigit: '0' },
      ],
    ])('should set bankDataUpdatedAt when %s', async (_case, existing, dataToUpdate) => {
      const payload = await updatePayloadFor(existingUserWithBankData(existing), dataToUpdate);

      expect(payload.bankDataUpdatedAt).toBeInstanceOf(Date);
      expect(payload.bankDataUpdatedAt).not.toEqual(PREVIOUS_BANK_DATA_DATE);
    });

    it.each<[string, Partial<User>]>([
      ['the same bank values are sent again', { bankCode: 104, bankAgency: '1234', bankAccount: '56789', bankAccountDigit: '0' }],
      ['bank values differ only in type or surrounding spaces', { bankCode: '104' as any, bankAgency: ' 1234 ' }],
      ['only non-bank fields change', { phone: '21888888888', email: 'novo@test.com' }],
    ])('should not touch bankDataUpdatedAt when %s', async (_case, dataToUpdate) => {
      const payload = await updatePayloadFor(existingUserWithBankData(), dataToUpdate);

      expect(payload).not.toHaveProperty('bankDataUpdatedAt');
    });

    it('should keep the stored bankDataUpdatedAt when the whole unchanged user is sent back', async () => {
      const existingUser = existingUserWithBankData();
      const wholeUser = existingUserWithBankData({ phone: '21777777777' });

      const payload = await updatePayloadFor(existingUser, wholeUser);

      expect(payload.bankDataUpdatedAt).toEqual(PREVIOUS_BANK_DATA_DATE);
    });

    it('should keep previousBankCode as the old bank code only when the bank code changes', async () => {
      const bankChange = await updatePayloadFor(existingUserWithBankData(), { bankCode: 1 });
      expect(bankChange.previousBankCode).toBe(104);

      (typeormRepository.update as jest.Mock).mockClear();
      const agencyChange = await updatePayloadFor(existingUserWithBankData(), { bankAgency: '9999' });
      expect(agencyChange).not.toHaveProperty('previousBankCode');
    });

    it.each<[string, Partial<User>, Partial<User>]>([
      ['the same bank code is sent as a string', {}, { bankCode: '104' as any }],
      [
        'the bank code is filled for the first time',
        { bankCode: undefined, bankDataUpdatedAt: null },
        { bankCode: 104 },
      ],
    ])('should not set previousBankCode when %s', async (_case, existing, dataToUpdate) => {
      const payload = await updatePayloadFor(existingUserWithBankData(existing), dataToUpdate);

      expect(payload).not.toHaveProperty('previousBankCode');
    });
  });
});
