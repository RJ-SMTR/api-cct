import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Provider } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FileUserInterface } from './interfaces/file-user.interface';
import { CreateUserExcelDto } from './dto/create-user-excel.dto';
import * as CLASS_VALIDATOR from 'class-validator';
import * as XLSX from 'xlsx';

describe('UsersService', () => {
  let usersService: UsersService;
  let usersRepository: Repository<User>;
  const USER_REPOSITORY_TOKEN = getRepositoryToken(User);
  const usersRepositoryMock = {
    provide: USER_REPOSITORY_TOKEN,
    useValue: {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    },
  } as Provider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, usersRepositoryMock],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    usersRepository = module.get<Repository<User>>(USER_REPOSITORY_TOKEN);
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
      } as User;

      jest.spyOn(usersRepository, 'save').mockResolvedValue(user);

      // Act
      const result = await usersService.create(createUserDto);

      // Assert
      expect(usersRepository.save).toBeCalled();
      expect(result).toEqual(user);
    });
  });

  describe('createFromFile', () => {
    it('should create users from a valid file', async () => {
      // Arrange
      const fileMock = {
        buffer: {},
      } as Express.Multer.File;

      const expectedFileUsers = [] as FileUserInterface[];
      for (let i = 0; i < 3; i++) {
        expectedFileUsers.push({
          row: i + 2,
          user: {
            email: `email_${i}@example.com`,
          },
          errors: {},
        } as FileUserInterface);
      }
      jest
        .spyOn(usersService, 'getExcelUsersFromWorksheet')
        .mockResolvedValue(expectedFileUsers);

      // Act
      await usersService.createFromFile(fileMock);

      // Assert
      expect(usersService.getExcelUsersFromWorksheet).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        expect.any(Function),
      );
      expect(usersRepository.save).toBeCalledTimes(expectedFileUsers.length);
    });

    it('should throw error if file content has errors', async () => {
      // Arrange
      const fileMock = {
        buffer: {},
      } as Express.Multer.File;

      const expectedFileUsers = [] as FileUserInterface[];
      for (let i = 0; i < 3; i++) {
        expectedFileUsers.push({
          row: i + 2,
          user: {
            email: `invalidEmail_${i} example.com`,
          },
          errors: {
            email: 'invalid',
          },
        } as FileUserInterface);
      }
      jest
        .spyOn(usersService, 'getExcelUsersFromWorksheet')
        .mockResolvedValue(expectedFileUsers);

      // Assert
      await expect(
        usersService.createFromFile(fileMock),
      ).rejects.toThrowError();
    });
  });

  describe('getExcelUsersFromWorksheet', () => {
    it('should extract users from a valid worksheet', async () => {
      // Arrange
      const worksheetMock = {};
      const expectedUserFields = ['permitCode', 'email'];
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue([
        {
          codigo_permissionario: 'permitCode1',
          email: 'test@example.com',
        },
      ]);
      jest.spyOn(CLASS_VALIDATOR, 'validate').mockReturnValue([]);
      const expectedResult = [
        {
          row: 2,
          user: {
            permitCode: 'permitCode1',
            email: 'test@example.com',
          },
          errors: {},
        },
      ] as FileUserInterface[];

      // Act
      const result = await usersService.getExcelUsersFromWorksheet(
        worksheetMock,
        expectedUserFields,
        CreateUserExcelDto,
      );

      // Assert
      expect(result).toEqual(expectedResult);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
