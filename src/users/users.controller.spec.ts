import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { IUserUploadResponse } from './interfaces/user-upload-response.interface';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

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
      const expectedResult = {
        uploadedUsers: 2,
        invalidUsers: 0,
        headerMap: { a: 'A', b: 'B' },
        invalidRows: [],
        uploadedRows: [{ user: 'user1' }, { user: 'user2' }],
      } as IUserUploadResponse;
      const request = { user: { id: 1 } } as IRequest;

      jest
        .spyOn(usersService, 'createFromFile')
        .mockResolvedValue(expectedResult);

      // Act
      const result = await usersController.postUpload(request, fileMock);

      // Assert
      expect(usersService.createFromFile).toHaveBeenCalledWith(
        fileMock,
        request.user,
      );
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
      const request = { user: { id: 1 } } as IRequest;

      jest.spyOn(usersService, 'createFromFile').mockRejectedValue(new Error());

      // Assert
      await expect(
        usersController.postUpload(request, fileMock),
      ).rejects.toThrowError();
    });
  });
});
