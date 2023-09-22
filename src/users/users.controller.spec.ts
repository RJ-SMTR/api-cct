import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { HttpStatus, Provider } from '@nestjs/common';

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const usersServiceMock = {
      provide: UsersService,
      useValue: {
        createFromFile: jest.fn(),
      },
    } as Provider;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [usersServiceMock],
    }).compile();

    usersController = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(usersService).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should upload a valid file', async () => {
      // Arrange
      const fileMock = {
        originalname: 'test.csv',
        mimetype: 'text/csv',
        path: 'something',
        buffer: Buffer.from('mock file content'),
      } as Express.Multer.File;
      const expectedResult = HttpStatus.CREATED;

      jest
        .spyOn(usersService, 'createFromFile')
        .mockResolvedValue(expectedResult);

      // Act
      const result = await usersController.uploadFile(fileMock);

      // Assert
      expect(usersService.createFromFile).toHaveBeenCalledWith(fileMock);
      expect(result).toBe(expectedResult);
    });
    it('should throw error when file is invalid', async () => {
      // Arrange
      const fileMock = {
        originalname: 'test.csv',
        mimetype: 'text/csv',
        path: 'something',
        buffer: Buffer.from('invalid file'),
      } as Express.Multer.File;

      jest.spyOn(usersService, 'createFromFile').mockRejectedValue(new Error());

      // Assert
      await expect(usersController.uploadFile(fileMock)).rejects.toThrowError();
    });
  });
});
