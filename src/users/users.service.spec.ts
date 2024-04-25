import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as CLASS_VALIDATOR from 'class-validator';
import { BanksService } from 'src/banks/banks.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';
import { InviteStatusEnum } from 'src/mail-history-statuses/mail-history-status.enum';
import { MailHistory } from 'src/mail-history/entities/mail-history.entity';
import { MailHistoryService } from 'src/mail-history/mail-history.service';
import { EntityManager, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { ICreateUserFile } from './interfaces/create-user-file.interface';
import { IFileUser } from './interfaces/file-user.interface';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let usersService: UsersService;
  let usersRepository: Repository<User>;
  let banksService: BanksService;
  let mailHistoryService: MailHistoryService;
  const USER_REPOSITORY_TOKEN = getRepositoryToken(User);
  const usersRepositoryMock = {
    provide: USER_REPOSITORY_TOKEN,
    useValue: {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
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
        usersRepositoryMock,
        mailHistoryServiceMock,
        banksServiceMock,
        entityManagerMock,
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    banksService = module.get<BanksService>(BanksService);
    usersRepository = module.get<Repository<User>>(USER_REPOSITORY_TOKEN);
    mailHistoryService = module.get<MailHistoryService>(MailHistoryService);

    jest.spyOn(banksService, 'findOne').mockResolvedValue(null);
  });

  it('should be defined', () => {
    expect(usersService).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      // Arrange
      const createUserDto = {
        email: 'test@example.com',
      } as CreateUserDto;
      const user = {
        email: createUserDto.email,
        getLogInfo: () => 'log info',
      } as User;

      jest.spyOn(usersRepository, 'save').mockResolvedValue(user);

      // Act
      const result = await usersService.create(createUserDto);

      // Assert
      expect(usersRepository.save).toBeCalled();
      expect(result).toEqual(user);
    });
  });

  describe('update', () => {
    it('should throw error when new email already exists', async () => {
      // Arrange
      const oldUser = {
        id: 1,
        email: 'old@email.com',
      } as User;
      const existingUser = {
        id: 2,
        email: 'existing@email.com',
      } as User;
      jest.spyOn(usersService, 'getOne').mockResolvedValue(oldUser);
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(existingUser);

      // Act
      const result = usersService.update(1, existingUser);

      // Assert
      await expect(result).rejects.toThrowError();
      expect(usersService.getOne).toBeCalled();
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
            nome: `fullName_${i}`,
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
      jest.spyOn(usersRepository, 'create').mockReturnValue(user);
      jest.spyOn(usersRepository, 'save').mockResolvedValue(user);
      jest
        .spyOn(mailHistoryService, 'create')
        .mockResolvedValue(createdMailHistory);

      // Act
      const response = await usersService.createFromFile(fileMock);

      // Assert
      expect(usersRepository.save).toBeCalledTimes(expectedFileUsers.length);
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
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue([fileUser]);
      jest.spyOn(CLASS_VALIDATOR, 'validate').mockResolvedValue([]);
      jest.spyOn(usersRepository, 'find').mockResolvedValue([]);

      const worksheetMock = XLSX.utils.json_to_sheet([fileUser]);
      const expectedResult = [
        {
          row: 2,
          user: fileUser,
          errors: {},
        },
      ] as IFileUser[];

      // Act
      const result = await usersService.getUserFilesFromWorksheet(worksheetMock);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should throw error invalid headers', async () => {
      // Arrange
      function testHeader(fileUser): Promise<IFileUser[]> {
        jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue([fileUser]);
        jest.spyOn(CLASS_VALIDATOR, 'validate').mockResolvedValue([]);
        jest.spyOn(usersRepository, 'find').mockResolvedValue([]);
        return usersService.getUserFilesFromWorksheet(XLSX.utils.json_to_sheet([fileUser])
        );
      }

      // Act
      const resultLessHeaders = testHeader({
        codigo_permissionario: 'permitCode1',
        email: 'test@example.com',
        cpf: '59777618212',
        nome: 'Henrique Santos Template',
      });
      const resultMoreHeaders = testHeader({
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
      async function testFile(fileUser: any): Promise<{
        result: IFileUser[];
        expectedResult: any;
      }> {
        jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue([fileUser]);
        jest.spyOn(CLASS_VALIDATOR, 'validate').mockResolvedValue([]);
        jest.spyOn(usersRepository, 'find').mockResolvedValue([]);
        const worksheetMock = XLSX.utils.json_to_sheet([fileUser]);
        const expectedResult = [
          {
            row: 2,
            user: fileUser,
            errors: {},
          },
        ] as IFileUser[];
        const result = await usersService.getUserFilesFromWorksheet(worksheetMock);
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
        cpf: "CPF inválido",
      };

      // Act
      const result = await usersService.getUserFilesFromWorksheet(worksheetMock);

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].errors).toEqual(expectedErrors);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
