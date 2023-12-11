import { HttpStatus } from '@nestjs/common';
import { differenceInSeconds } from 'date-fns';
import * as fs from 'fs';
import { generate } from 'gerador-validador-cpf';
import * as path from 'path';
import * as request from 'supertest';
import * as XLSX from 'xlsx';
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
  describe('Phase 1: Upload users', () => {
    let uploadUsers: any[];
    let users: any[] = [];

    beforeAll(() => {
      const randomCode = Math.random().toString(36).slice(-8);
      uploadUsers = [
        {
          codigo_permissionario: `permitCode_${randomCode}`,
          nome: `name_${randomCode}`,
          email: `user.${randomCode}@test.com`,
          telefone: `219${Math.random().toString().slice(2, 10)}`,
          cpf: generate(),
        },
      ];
    });

    test(`Upload users, status = 'queued'`, async () => {
      // Arrange
      const excelFilePath = path.join(tempFolder, 'newUsers.xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(uploadUsers);
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

      users = await request(app)
        .get('/api/v1/users/')
        .auth(apiToken, {
          type: 'bearer',
        })
        .query({ permitCode: uploadUsers[0].codigo_permissionario })
        .then(({ body }) => {
          expect(body.data.length).toBe(1);
          expect(body.data[0]?.aux_inviteStatus?.name).toEqual('queued');
          return body.data;
        });
    });

    test(`Resend new user invite, status = 'sent'`, async () => {
      const newUser = users[0];
      expect(newUser?.id).toBeDefined();

      await request(APP_URL)
        .post('/api/v1/auth/email/resend')
        .auth(apiToken, {
          type: 'bearer',
        })
        .send({
          id: newUser.id,
        })
        .expect(HttpStatus.NO_CONTENT);
      const forgotLocalDate = new Date();
      forgotLocalDate.setMinutes(
        forgotLocalDate.getMinutes() + global.__localTzOffset,
      );

      newUser.hash = await request(MAILDEV_URL)
        .get('/email')
        .then(({ body }) =>
          (body as any[])
            .filter(
              (letter: any) =>
                letter.to[0].address.toLowerCase() ===
                  newUser.email.toLowerCase() &&
                /.*conclude\-registration\/(\w+).*/g.test(letter.text) &&
                differenceInSeconds(forgotLocalDate, new Date(letter.date)) <=
                  10,
            )
            .pop()
            ?.text.replace(/.*conclude\-registration\/(\w+).*/g, '$1'),
        );

      await request(APP_URL)
        .post(`/api/v1/auth/licensee/invite/${newUser.hash}`)
        .expect(HttpStatus.OK)
        .then(({ body }) => {
          expect(body.email).toEqual(newUser.email);
          expect(body?.inviteStatus?.name).toEqual('sent');
        });

      users[0] = newUser;
    });

    test(`New user conclude registration, status = 'used'`, async () => {
      const newUser = users[0];
      expect(newUser?.hash).toBeDefined();

      const newPassword = Math.random().toString(36).slice(-8);
      await request(APP_URL)
        .post(`/api/v1/auth/licensee/register/${newUser.hash}`)
        .send({ password: newPassword })
        .expect(HttpStatus.OK)
        .then(({ body }) => {
          expect(body.user.aux_inviteStatus?.name).toEqual('used');
          expect(body.token).toBeDefined();
        });

      newUser.password = newPassword;
      users[0] = newUser;
    });

    test('New user login', async () => {
      const newUser = users[0];
      await request(APP_URL)
        .post(`/api/v1/auth/licensee/login`)
        .send({ permitCode: newUser.permitCode, password: newUser.password })
        .expect(HttpStatus.OK)
        .then(({ body }) => {
          expect(body.token).toBeDefined();
        });
    });
  });
});
