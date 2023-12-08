import { HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as request from 'supertest';
import * as XLSX from 'xlsx';
// import * as path from 'path';
import { generate } from 'gerador-validador-cpf';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  APP_URL,
  MAILDEV_URL,
} from '../utils/constants';

describe('Admin managing users (e2e)', () => {
  const app = APP_URL;
  const tempFolder = path.join(__dirname, 'temp');
  let apiToken: any = {};

  beforeAll(async () => {
    await request(app)
      .post('/api/v1/auth/admin/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .then(({ body }) => {
        apiToken = body.token;
      });

    if (!fs.existsSync(tempFolder)) {
      fs.mkdirSync(tempFolder);
    }
  });

  describe('Setup tests', () => {
    it('Should have UTC and local timezones', () => {
      new Date().getTimezoneOffset();
      expect(process.env.TZ).toEqual('UTC');
      expect(global.__localTzOffset).toBeDefined();
    });

    it('Should have mailDev server', async () => {
      await request(MAILDEV_URL).get('').expect(HttpStatus.OK);
    });
  });

  /**
   * @see {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 Phase 1, requirements #94 - GitHub}
   */
  describe('Upload users', () => {
    let users: any[];

    beforeAll(() => {
      const randomCode = Math.random().toString(36).slice(-8);
      users = [
        {
          codigo_permissionario: `permitCode_${randomCode}`,
          nome: `name_${randomCode}`,
          email: `user.${randomCode}@test.com`,
          telefone: `219${Math.random().toString().slice(2, 10)}`,
          cpf: generate(),
        },
      ];
    });

    it('Should upload users and get inviteStatus = QUEUED', async () => {
      // Arrange
      const excelFilePath = path.join(tempFolder, 'newUsers.xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(users);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      XLSX.writeFile(workbook, excelFilePath);

      // Assert
      await request(app)
        .post('/api/v1/users/upload')
        .auth(apiToken, {
          type: 'bearer',
        })
        .attach('file', excelFilePath)
        .expect(HttpStatus.CREATED)
        .expect(({ body }) => {
          expect(body.uploadedUsers).toEqual(1);
        });

      await request(app)
        .get('/api/v1/users/')
        .auth(apiToken, {
          type: 'bearer',
        })
        .query({ permitCode: users[0].codigo_permissionario })
        .then(({ body }) => {
          expect(body.data.length).toBe(1);
          expect(body.data[0]?.aux_inviteStatus?.name).toEqual('queued');
        });
    });
  });
});

// it('Login via registered user: /api/v1/auth/email/login (POST)', () => {
//   return request(app)
//     .post('/api/v1/auth/email/login')
//     .send({ email: userEmail, password: userChangedPassword })
//     .expect(200)
//     .expect(({ body }) => {
//       expect(body.token).toBeDefined();
//     });
// });

// it('Fail create new user by admin: /api/v1/users (POST)', () => {
//   return request(app)
//     .post(`/api/v1/users`)
//     .auth(apiToken, {
//       type: 'bearer',
//     })
//     .send({ email: 'fail-data' })
//     .expect(422);
// });

// it('Success create new user by admin: /api/v1/users (POST)', () => {
//   return request(app)
//     .post(`/api/v1/users`)
//     .auth(apiToken, {
//       type: 'bearer',
//     })
//     .send({
//       email: newUserEmail,
//       password: userPassword,
//       firstName: `UserByAdmin${Date.now()}`,
//       lastName: 'E2E',
//       role: {
//         id: RoleEnum.user,
//       },
//       status: {
//         id: StatusEnum.active,
//       },
//     })
//     .expect(201);
// });

// it('Login via created by admin user: /api/v1/auth/email/login (GET)', () => {
//   return request(app)
//     .post('/api/v1/auth/email/login')
//     .send({
//       email: newUserEmail,
//       password: userPassword,
//     })
//     .expect(200)
//     .expect(({ body }) => {
//       expect(body.token).toBeDefined();
//     });
// });

// it('Get list of users by admin: /api/v1/users (GET)', () => {
//   return request(app)
//     .get(`/api/v1/users`)
//     .auth(apiToken, {
//       type: 'bearer',
//     })
//     .expect(200)
//     .send()
//     .expect(({ body }) => {
//       expect(body.data[0].provider).toBeDefined();
//       expect(body.data[0].email).toBeDefined();
//       expect(body.data[0].hash).not.toBeDefined();
//       expect(body.data[0].password).not.toBeDefined();
//       expect(body.data[0].previousPassword).not.toBeDefined();
//     });
// });
