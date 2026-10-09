import { HttpStatus, INestApplication } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AllExceptionsFilter } from 'src/utils/all-exteptions-filter/filters/all-exceptions.filter';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController (HTTP)', () => {
  let app: INestApplication;
  const usersServiceMock = {
    createFromFile: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /users/upload', () => {
    it('rejects a file larger than 10 MB before it reaches the service', async () => {
      const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024, 'a');

      await request(app.getHttpServer())
        .post('/users/upload')
        .attach('file', oversizedBuffer, 'big.csv')
        .expect(HttpStatus.PAYLOAD_TOO_LARGE);

      expect(usersServiceMock.createFromFile).not.toHaveBeenCalled();
    });

    it('accepts a file within the 10 MB limit and reaches the service (regression)', async () => {
      usersServiceMock.createFromFile.mockResolvedValue({
        headerMap: {},
        uploadedUsers: 1,
        invalidUsers: 0,
        invalidRows: [],
        uploadedRows: [],
      });
      const smallBuffer = Buffer.from('codigo_permissionario,email,nome,telefone,cpf\n');

      await request(app.getHttpServer())
        .post('/users/upload')
        .attach('file', smallBuffer, 'small.csv')
        .expect(HttpStatus.CREATED);

      expect(usersServiceMock.createFromFile).toHaveBeenCalledTimes(1);
    });

    it('accepts a file exactly at the 10 MB limit (boundary)', async () => {
      // busboy/multer's limits.fileSize rejects a file of exactly the configured size (it
      // flags "truncated" at the Nth byte without waiting to see if more data follows), so
      // the controller configures the limit as "10 MB + 1 byte" for a real 10 MB file to
      // succeed - verified here, not assumed, since it's third-party behavior.
      usersServiceMock.createFromFile.mockResolvedValue({
        headerMap: {},
        uploadedUsers: 0,
        invalidUsers: 0,
        invalidRows: [],
        uploadedRows: [],
      });
      const exactLimitBuffer = Buffer.alloc(10 * 1024 * 1024, 'a');

      await request(app.getHttpServer())
        .post('/users/upload')
        .attach('file', exactLimitBuffer, 'exact.csv')
        .expect(HttpStatus.CREATED);

      expect(usersServiceMock.createFromFile).toHaveBeenCalledTimes(1);
    });
  });
});
