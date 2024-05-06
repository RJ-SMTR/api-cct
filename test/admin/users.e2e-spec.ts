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
  LICENSEE_CASE_ACCENT,
  LICENSEE_CPF_PERMIT_CODE,
  MAILDEV_URL,
  TO_UPDATE_PERMIT_CODE,
} from '../utils/constants';
import { getStringUpperUnaccent } from 'src/utils/string-utils';

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
    it('should have UTC and local timezones', () => {
      new Date().getTimezoneOffset();
      expect(process.env.TZ).toEqual('UTC');
      expect(global.__localTzOffset).toBeDefined();
    });

    it('should have mailDev server', async () => {
      await request(MAILDEV_URL).get('').expect(HttpStatus.OK);
    });
  });

  describe('Manage users', () => {
    test('Filter users', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 7 - GitHub}
     */ async () => {
      // Arrange
      await request(app)
        .get('/api/v1/test/users/reset-testing-users')
        .expect(200);
      const licensee = await request(app)
        .get('/api/v1/users/')
        .auth(apiToken, {
          type: 'bearer',
        })
        .query({ permitCode: LICENSEE_CPF_PERMIT_CODE })
        .expect(({ body }) => {
          expect(body.data?.length).toBe(1);
        })
        .then(({ body }) => body.data);
      const licenseePartOfName = 'user';
      const args = [
        {
          filter: { name: getStringUpperUnaccent(LICENSEE_CASE_ACCENT) },
          expect: (body: any) =>
            expect(
              body.data.some((i: any) => i.fullName === LICENSEE_CASE_ACCENT),
            ).toBeTruthy(),
        },
        {
          filter: { permitCode: licensee.permitCode },
          expect: (body: any) =>
            expect(
              body.data.some(
                (i: any) => i.permitCode === LICENSEE_CPF_PERMIT_CODE,
              ),
            ).toBeTruthy(),
        },
        {
          filter: { name: licensee.fullName },
          expect: (body: any) =>
            expect(
              body.data.some(
                (i: any) => i.permitCode === LICENSEE_CPF_PERMIT_CODE,
              ),
            ).toBeTruthy(),
        },
        {
          filter: { email: licensee.email },
          expect: (body: any) =>
            expect(
              body.data.some(
                (i: any) => i.permitCode === LICENSEE_CPF_PERMIT_CODE,
              ),
            ).toBeTruthy(),
        },
        {
          filter: { name: licenseePartOfName, inviteStatus: 'queued' },
          expect: (body: any) =>
            expect(
              body.data.some((i: any) => i.fullName === 'Queued user'),
            ).toBeTruthy(),
        },
        {
          filter: { name: licenseePartOfName, inviteStatus: 'sent' },
          expect: (body: any) =>
            expect(
              body.data.some((i: any) => i.fullName === 'Sent user'),
            ).toBeTruthy(),
        },
        {
          filter: { name: licenseePartOfName, inviteStatus: 'used' },
          expect: (body: any) =>
            expect(
              body.data.some((i: any) => i.fullName === 'Used user'),
            ).toBeTruthy(),
        },
      ];

      // Assert
      for (const arg of args) {
        await request(app)
          .get('/api/v1/users/')
          .auth(apiToken, {
            type: 'bearer',
          })
          .query(arg.filter)
          .expect(HttpStatus.OK)
          .then(({ body }) => {
            arg.expect(body);
            return body.data;
          });
      }
    }, 20000);
  });

  describe('Upload users', () => {
    let users: any[] = [];

    test(`Upload users, status = 'queued'`, /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 3 - GitHub}
     */ async () => {
      // Arrange
       const randomCode = Math.random().toString(36).slice(-8);
       const uploadUsers = [
         {
           codigo_permissionario: `permitCode_${randomCode}`,
           nome: `Café_${randomCode}`,
           email: `user.${randomCode}@test.com`,
           telefone: `219${Math.random().toString().slice(2, 10)}`,
           cpf: generate(),
         },
       ];
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
        .expect(({ body }) => {
          expect(body.data?.length).toBe(1);
          expect(body.data[0]?.fullName).toEqual(
            getStringUpperUnaccent(uploadUsers[0].nome),
          );
          expect(body.data[0]?.aux_inviteStatus?.name).toEqual('queued');
        })
        .then(({ body }) => body.data);
    });

    test(`Resend new user invite, status = 'sent'`, /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 4 - GitHub}
     */ async () => {
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
        .expect(({ body }) => {
          expect(body.email).toEqual(newUser.email);
          expect(body?.inviteStatus?.name).toEqual('sent');
        });

      users[0] = newUser;
    });

    test(`New user conclude registration, status = 'used'`, /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 5 - GitHub}
     */ async () => {
      const newUser = users[0];
      expect(newUser?.hash).toBeDefined();

      const newPassword = Math.random().toString(36).slice(-8);
      await request(APP_URL)
        .post(`/api/v1/auth/licensee/register/${newUser.hash}`)
        .send({ password: newPassword })
        .expect(HttpStatus.OK)
        .expect(({ body }) => {
          expect(body.user.aux_inviteStatus?.name).toEqual('used');
          expect(body.token).toBeDefined();
        });

      newUser.password = newPassword;
      users[0] = newUser;
    });

    test('New user login', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 6 - GitHub}
     */ async () => {
      const newUser = users[0];
      await request(APP_URL)
        .post(`/api/v1/auth/licensee/login`)
        .send({ permitCode: newUser.permitCode, password: newUser.password })
        .expect(HttpStatus.OK)
        .expect(({ body }) => {
          expect(body.token).toBeDefined();
        });
      });

    test('Upload invalid cpf, block upload', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 3 - GitHub}
     */ async () => {
      // Arrange
      const randomCode1 = Math.random().toString(36).slice(-8);
      const randomCode2 = Math.random().toString(36).slice(-8);
      const uploadUsers = [
        {
          codigo_permissionario: `permitCode_${randomCode1}`,
          nome: `Café_${randomCode1}`,
          email: `user.${randomCode1}@mai.com`,
          telefone: `219${Math.random().toString().slice(2, 10)}`,
          cpf: `invalid_cpf_${randomCode1}`,
        },
        {
          codigo_permissionario: `permitCode_${randomCode2}`,
          nome: `Café_${randomCode2}`,
          email: `user.${randomCode2}@mai.com`,
          telefone: `219${Math.random().toString().slice(2, 10)}`,
          cpf: `invalid_cpf_${randomCode2}`,
        },
      ];
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
        .expect(HttpStatus.UNPROCESSABLE_ENTITY)
        .expect(({ body }) => {
          const invalidRows = body.error.file.invalidRows;
          expect(invalidRows.length).toBeGreaterThan(0);
          expect(invalidRows[0].errors).toMatchObject({
            cpf: 'CPF inválido',
          });
        });
    });

    test('Patch cpf, throw error', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 3 - GitHub}
     */ async () => {
      const user = await request(app)
        .get('/api/v1/users/')
        .auth(apiToken, {
          type: 'bearer',
        })
        .query({ permitCode: TO_UPDATE_PERMIT_CODE })
        .expect(({ body }) => {
          expect(body.data.length).toBe(1);
        })
        .then(({ body }) => body.data[0]);

      // Assert
      await request(app)
        .patch(`/api/v1/users/${user.id}`)
        .auth(apiToken, {
          type: 'bearer',
        })
        .send({
          cpfCnpj: generate(),
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    test('Patch bankAccount, success', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 3 - GitHub}
     */ async () => {
      //  Arrange
      const random4Nums = Math.floor(1000 + Math.random() * 9000);
      const user = await request(app)
        .get('/api/v1/users/')
        .auth(apiToken, {
          type: 'bearer',
        })
        .query({ permitCode: TO_UPDATE_PERMIT_CODE })
        .expect(({ body }) => {
          expect(body.data.length).toBe(1);
        })
        .then(({ body }) => body.data[0]);

      // Assert
      await request(app)
        .patch(`/api/v1/users/${user.id}`)
        .auth(apiToken, {
          type: 'bearer',
        })
        .send({
          bankAccount: random4Nums,
        })
        .expect(HttpStatus.OK)
        .expect(({ body }) => {
          expect(body.bankAccount).toEqual(String(random4Nums));
        });
    });

    test('Upload invalid cpf, block upload', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 3 - GitHub}
     */ async () => {
      // Arrange
      const randomCode1 = Math.random().toString(36).slice(-8);
      const randomCode2 = Math.random().toString(36).slice(-8);
      const uploadUsers = [
        {
          codigo_permissionario: `permitCode_${randomCode1}`,
          nome: `Café_${randomCode1}`,
          email: `user.${randomCode1}@mai.com`,
          telefone: `219${Math.random().toString().slice(2, 10)}`,
          cpf: `invalid_cpf_${randomCode1}`,
        },
        {
          codigo_permissionario: `permitCode_${randomCode2}`,
          nome: `Café_${randomCode2}`,
          email: `user.${randomCode2}@mai.com`,
          telefone: `219${Math.random().toString().slice(2, 10)}`,
          cpf: `invalid_cpf_${randomCode2}`,
        },
      ];
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
        .expect(HttpStatus.UNPROCESSABLE_ENTITY)
        .expect(({ body }) => {
          const invalidRows = body.error.file.invalidRows;
          expect(invalidRows.length).toBeGreaterThan(0);
          expect(invalidRows[0].errors).toMatchObject({
            cpf: 'CPF inválido',
          });
        });
    });

    test('Patch cpf, throw error', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 3 - GitHub}
     */ async () => {
      const user = await request(app)
        .get('/api/v1/users/')
        .auth(apiToken, {
          type: 'bearer',
        })
        .query({ permitCode: TO_UPDATE_PERMIT_CODE })
        .expect(({ body }) => {
          expect(body.data.length).toBe(1);
        })
        .then(({ body }) => body.data[0]);

      // Assert
      await request(app)
        .patch(`/api/v1/users/${user.id}`)
        .auth(apiToken, {
          type: 'bearer',
        })
        .send({
          cpfCnpj: generate(),
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    test('Patch bankAccount, success', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 3 - GitHub}
     */ async () => {
      //  Arrange
      const random4Nums = Math.floor(1000 + Math.random() * 9000);
      const user = await request(app)
        .get('/api/v1/users/')
        .auth(apiToken, {
          type: 'bearer',
        })
        .query({ permitCode: TO_UPDATE_PERMIT_CODE })
        .expect(({ body }) => {
          expect(body.data.length).toBe(1);
        })
        .then(({ body }) => body.data[0]);

      // Assert
      await request(app)
        .patch(`/api/v1/users/${user.id}`)
        .auth(apiToken, {
          type: 'bearer',
        })
        .send({
          bankAccount: random4Nums,
        })
        .expect(HttpStatus.OK)
        .expect(({ body }) => {
          expect(body.bankAccount).toEqual(String(random4Nums));
        });
    });
  });
});
