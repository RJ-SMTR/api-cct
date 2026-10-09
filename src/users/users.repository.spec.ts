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
  let typeormRepository: Pick<Repository<User>, 'createQueryBuilder' | 'update' | 'findOne'>;
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
      update: jest.fn(),
      findOne: jest.fn(),
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
