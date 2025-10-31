import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BanksService } from 'src/service/banks.service';
import { InviteStatus } from 'src/domain/entity/mail-history-status.entity';
import { InviteStatusEnum } from 'src/domain/enum/mail-history-status.enum';
import { MailHistory } from 'src/domain/entity/mail-history.entity';
import { MailHistoryService } from 'src/service/mail-history.service';
import { EntityManager } from 'typeorm';
import * as XLSX from 'xlsx';
import { CreateUserDto } from '../domain/dto/create-user.dto';
import { ICreateUserFile } from '../domain/interface/create-user-file.interface';
import { IFileUser } from '../domain/interface/file-user.interface';
import { UsersService } from './users.service';
import { UsersRepository } from 'src/repository/users.repository';
import { User } from 'src/domain/entity/user.entity';

describe('UsersService', () => {
  let usersService: UsersService;
  let usersRepositoryService: UsersRepository;
  let banksService: BanksService;
  let mailHistoryService: MailHistoryService;

  const usersRepositoryServiceMock = {
    provide: UsersRepository,
    useValue: {
      create: jest.fn(),
      save: jest.fn(),
      findMany: jest.fn(),
      findOne: jest.fn(),
      getOne: jest.fn(),
    },
  } as Provider;
  const mailHistoryServiceMock = {
    provide: MailHistoryService,
    useValue: {
      find: jest.fn(),
      findRecentByUser: jest.fn(),
      getOne: jest.fn(),
      generateHash: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  } as Provider;
  const banksServiceMock = {
    provide: BanksService,
    useValue: {
      findOne: jest.fn(),
    },
  } as Provider;
  const entityManagerMock = {
    provide: EntityManager,
    useValue: {
      createQueryBuilder: jest.fn(),
      transaction: jest.fn(),
    },
  } as Provider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        usersRepositoryServiceMock,
        mailHistoryServiceMock,
        banksServiceMock,
        entityManagerMock,
      ],
    }).compile();

    usersService = module.get(UsersService);
    banksService = module.get(BanksService);
    usersRepositoryService = module.get<UsersRepository>(UsersRepository);
    mailHistoryService = module.get(MailHistoryService);

    jest.spyOn(banksService, 'findOne').mockResolvedValue(null);
  });

  it('should be defined', () => {
    expect(usersService).toBeDefined();
  });

  describe('create', () => {
    it('should create an user', async () => {
      // Arrange
      const createUserDto = {
        email: 'test@example.com',
      } as CreateUserDto;
      const user = new User({
        email: createUserDto.email,
        getLogInfo: () => 'log info',
      });

      jest.spyOn(usersRepositoryService, 'create').mockResolvedValue(user);

      // Act
      const result = await usersService.create(createUserDto);

      // Assert
      expect(usersRepositoryService.create).toBeCalled();
      expect(result).toEqual(user);
    });
  });

  describe('createFromFile', () => {
    it('should create users from a valid file', async () => {
      // Arrange
      const user = new User({ email: 'email_1@example.com' });
      const fileMock = {
        buffer: {},
      } as Express.Multer.File;

      const expectedFileUsers = [] as IFileUser[];
      for (let i = 0; i < 3; i++) {
        expectedFileUsers.push({
          row: i + 2,
          user: {
            email: `email_${i}@example.com`,
            nome: `nome ${i}`,
          },
          errors: {},
        } as IFileUser);
      }
      const createdMailHistory = new MailHistory({
        email: `email@example.com`,
        inviteStatus: new InviteStatus(InviteStatusEnum.queued),
      });
      jest
        .spyOn(usersService, 'getUserFilesFromWorksheet')
        .mockResolvedValue(expectedFileUsers);
      jest.spyOn(usersRepositoryService, 'create').mockResolvedValue(user);
      jest
        .spyOn(mailHistoryService, 'create')
        .mockResolvedValue(createdMailHistory);

      // Act
      const response = await usersService.createFromFile(fileMock);

      // Assert
      expect(mailHistoryService.create).toBeCalledTimes(
        expectedFileUsers.length,
      );
      expect(response.invalidUsers).toEqual(0);
      expect(response.uploadedUsers).toEqual(3);
    });

    it('should throw error if field value has errors', async () => {
      // Arrange
      const fileMock = {
        buffer: {},
      } as Express.Multer.File;

      const expectedFileUsers = [] as IFileUser[];
      for (let i = 0; i < 3; i++) {
        expectedFileUsers.push({
          row: i + 2,
          user: {
            cpf: '21138266217',
          },
          errors: {
            cpf: 'invalid',
          },
        } as IFileUser);
      }
      jest
        .spyOn(usersService, 'getUserFilesFromWorksheet')
        .mockResolvedValue(expectedFileUsers);

      // Assert
      await expect(
        usersService.createFromFile(fileMock),
      ).rejects.toThrowError();
    });
  });

  describe('getUserFilesFromWorksheet', () => {
    it('should extract users from a valid worksheet', async () => {
      // Arrange
      const fileUser = {
        codigo_permissionario: 'permitCode1',
        email: 'test@example.com',
        cpf: '59777618212',
        nome: 'Henrique Santos Template',
        telefone: '21912345678',
      } as Partial<ICreateUserFile>;
      jest.spyOn(usersRepositoryService, 'findMany').mockResolvedValue([]);

      const worksheetMock = XLSX.utils.json_to_sheet([fileUser]);
      const expectedResult = [
        {
          row: 2,
          user: fileUser,
          errors: {},
        },
      ] as IFileUser[];

      // Act
      const result = await usersService.getUserFilesFromWorksheet(
        worksheetMock,
      );

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should throw error invalid headers', async () => {
      // Arrange
      jest.spyOn(usersService, 'findMany').mockResolvedValue([]);

      // Act
      const resultLessHeaders = usersService.getUserFilesFromWorksheet(
        XLSX.utils.json_to_sheet([
          {
            codigo_permissionario: 'permitCode1',
            email: 'test@example.com',
            cpf: '59777618212',
            nome: 'Henrique Santos Template',
          },
        ]),
      );
      const resultMoreHeaders = usersService.getUserFilesFromWorksheet({
        codigo_permissionario: 'permitCode1',
        email: 'test@example.com',
        cpf: '59777618212',
        nome: 'Henrique Santos Template',
        telefone: '21912345678',
        telefone2: '21912345678',
      });

      // Assert
      await expect(resultLessHeaders).rejects.toThrowError();
      await expect(resultMoreHeaders).rejects.toThrowError();
    });

    it('should extract users when valid content, even if headers are unsorted', async () => {
      // Arrange
      jest.spyOn(usersService, 'findMany').mockResolvedValue([]);

      async function testFile(fileUser: any): Promise<{
        result: IFileUser[];
        expectedResult: any;
      }> {
        const expectedResult = [
          {
            row: 2,
            user: fileUser,
            errors: {},
          },
        ] as IFileUser[];
        const result = await usersService.getUserFilesFromWorksheet(
          XLSX.utils.json_to_sheet([fileUser]),
        );
        return { result, expectedResult };
      }

      // Act
      const resultSorted = await testFile({
        codigo_permissionario: 'permitCode1',
        email: 'test@example.com',
        telefone: '21912345678',
        nome: 'Henrique Santos Template',
        cpf: '59777618212',
      });
      const resultUnsorted = await testFile({
        email: 'test@example.com',
        codigo_permissionario: 'permitCode1',
        cpf: '59777618212',
        nome: 'Henrique Santos Template',
        telefone: '21912345678',
      });

      // Assert
      expect(resultSorted.result).toEqual(resultSorted.expectedResult);
      expect(resultUnsorted.result).toEqual(resultUnsorted.expectedResult);
    });

    /**
     * Just to check if cpf validation is wotking on upload
     * @see {@link https://github.com/RJ-SMTR/api-cct/issues/229 #229 - Github}
     */
    it('should return error if invalid cpf', async () => {
      // Arrange
      const fileUser = {
        codigo_permissionario: 'permitCode1',
        email: 'test@example.com',
        cpf: 'invalid_cpf',
        nome: 'Henrique Santos Template',
        telefone: '21912345678',
      } as Partial<ICreateUserFile>;
      jest.spyOn(usersService, 'findMany').mockResolvedValueOnce([]);

      const worksheetMock = XLSX.utils.json_to_sheet([fileUser]);
      const expectedErrors: Partial<ICreateUserFile> = {
        cpf: 'CPF inválido',
      };

      // Act
      const result = await usersService.getUserFilesFromWorksheet(
        worksheetMock,
      );

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].errors).toEqual(expectedErrors);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
