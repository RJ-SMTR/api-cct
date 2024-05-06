import { HttpStatus } from '@nestjs/common';
import { differenceInSeconds } from 'date-fns';
import * as request from 'supertest';
import {
  ADMIN_2_EMAIL,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  APP_URL,
  MAILDEV_URL,
} from '../utils/constants';

describe('Admin auth (e2e)', () => {
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

  describe('Phase 1: Admin basics and user management', () => {
    test('Login admin: POST /api/v1/auth/admin/email/login', () => {
      return request(APP_URL)
        .post('/api/v1/auth/admin/email/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(HttpStatus.OK)
        .expect(({ body }) => {
          expect(body.token).toBeDefined();
          expect(body.user.email).toBeDefined();
        });
    });

    test('Reset admin password', /**
     * Requirement: 2023/11/16 {@link https://github.com/RJ-SMTR/api-cct/issues/94#issuecomment-1815016208 #94, item 1 - GitHub}
     */ async () => {
      await request(APP_URL)
        .post('/api/v1/auth/forgot/password')
        .send({
          email: ADMIN_2_EMAIL,
        })
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
                  ADMIN_2_EMAIL.toLowerCase() &&
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
        .post('/api/v1/auth/admin/email/login')
        .send({ email: ADMIN_2_EMAIL, password: newPassword })
        .expect(HttpStatus.OK);
    }, 60000);
  });
});
