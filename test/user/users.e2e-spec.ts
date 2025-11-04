import { HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { User } from 'src/antigo/users/entities/user.entity';
import * as request from 'supertest';
import {
  APP_URL,
  LICENSEE_CPF_PASSWORD,
  LICENSEE_CPF_PERMIT_CODE
} from '../utils/constants';

describe('Users managing itself (e2e)', () => {
  const app = APP_URL;
  const tempFolder = path.join(__dirname, 'temp');
  let apiToken: any = {};
  let user: User = new User();

  beforeAll(async () => {
    await request(app)
      .post('/api/v1/auth/licensee/login')
      .send({
        permitCode: LICENSEE_CPF_PERMIT_CODE,
        password: LICENSEE_CPF_PASSWORD,
      })
      .then(({ body }) => {
        apiToken = body.token;
        user = new User(body.user);
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
  });

  describe('Manage users', () => {
    test('Should block User account digit length > 1', /**
     * Requirement reviewed: 2024/08/02 {@link https://github.com/RJ-SMTR/api-cct/issues/366 #366 - GitHub}
     */ async () => {
      // Assert
      await request(app)
        .patch(`/api/v1/users/${user.id}`)
        .auth(apiToken, { type: 'bearer' })
        .send({ bankAccountDigit: '12' })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY);
      }, 20000);
    
    test('Should allow User account digit = 1', /**
     * Requirement reviewed: 2024/08/02 {@link https://github.com/RJ-SMTR/api-cct/issues/366 #366 - GitHub}
     */ async () => {
      // Assert
      await request(app)
        .patch(`/api/v1/users/${user.id}`)
        .auth(apiToken, { type: 'bearer' })
        .send({ bankAccountDigit: '3' })
        .expect(HttpStatus.OK);
    }, 20000);
  });
});
