import { HttpStatus } from '@nestjs/common';
import { differenceInSeconds } from 'date-fns';
import * as request from 'supertest';
import {
  APP_URL,
  LICENSEE_CPF_PASSWORD,
  LICENSEE_CPF_PERMIT_CODE,
  LICENSEE_TEST_EMAIL,
  LICENSEE_TEST_PERMIT_CODE,
  MAILDEV_URL,
} from '../utils/constants';

describe('User auth (e2e)', () => {
  const app = APP_URL;

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

  /**
   * Requirements: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 Phase 1, requirements #94 - GitHub}
   */
  describe('Phase 1: User basics', () => {
    test('Login user: POST /api/v1/auth/licensee/login', () => {
      return request(app)
        .post('/api/v1/auth/licensee/login')
        .send({
          permitCode: LICENSEE_CPF_PERMIT_CODE,
          password: LICENSEE_CPF_PASSWORD,
        })
        .expect(HttpStatus.OK);
    });

    test('Reset user password', async () => {
      await request(APP_URL)
        .post('/api/v1/auth/forgot/password')
        .send({ email: LICENSEE_TEST_EMAIL })
        .expect(HttpStatus.ACCEPTED);
      const forgotLocalDate = new Date();
      forgotLocalDate.setMinutes(
        forgotLocalDate.getMinutes() + global.__localTzOffset,
      );

      const hash = await request(MAILDEV_URL)
        .get('/email')
        .then(({ body }) =>
          (body as any[])
            .filter(
              (letter: any) =>
                letter.to[0].address.toLowerCase() ===
                  LICENSEE_TEST_EMAIL.toLowerCase() &&
                /.*reset\-password\/(\w+).*/g.test(letter.text) &&
                differenceInSeconds(forgotLocalDate, new Date(letter.date)) <=
                  10,
            )
            .pop()
            ?.text.replace(/.*reset\-password\/(\w+).*/g, '$1'),
        );

      const newPassword = Math.random().toString(36).slice(-8);
      await request(APP_URL)
        .post('/api/v1/auth/reset/password')
        .send({
          hash,
          password: newPassword,
        })
        .expect(HttpStatus.NO_CONTENT);

      await request(APP_URL)
        .post('/api/v1/auth/licensee/login')
        .send({ permitCode: LICENSEE_TEST_PERMIT_CODE, password: newPassword })
        .expect(HttpStatus.OK);
    }, 60000);
  });
});
