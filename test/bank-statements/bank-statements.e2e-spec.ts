import * as request from 'supertest';
import {
  APP_URL,
  LICENSEE_PASSWORD,
  LICENSEE_PERMIT_CODE,
} from '../utils/constants';

describe('Bank statements (e2e)', () => {
  const app = APP_URL;
  // let newUserFirst;
  // const newUserEmailFirst = `user-first.${Date.now()}@example.com`;
  // const newUserChangedPasswordFirst = `new-secret`;
  // const newUserByAdminEmailFirst = `user-created-by-admin.${Date.now()}@example.com`;
  // const newUserByAdminPasswordFirst = `secret`;
  // let apiToken;

  beforeAll(async () => {
    console.log('REQ ARGS');
    await request(app)
      .post('/api/v1/auth/licensee/login')
      .send({ permitCode: LICENSEE_PERMIT_CODE, password: LICENSEE_PASSWORD })
      .expect(200);
    // .then(({ body }) => {
    //   apiToken = body.token;
    // });
  });

  // it('Should /bank-statements amount sum match in the same month /ticket-revenues/me', () => {
  //   // Act
  //   const requestArgs = {
  //     timeInterval: 'lastMonth',
  //   };
  //   console.log('INI');
  //   let bankStatements;
  //   request(app)
  //     .patch('/api/v1/bank-statements/me')
  //     .auth(apiToken, {
  //       type: 'bearer',
  //     })
  //     .send(requestArgs)
  //     .expect(200)
  //     .then(({ body }) => {
  //       console.log({ body });
  //       bankStatements = body;
  //     });

  //   let ticketRevenuesMe;
  //   request(app)
  //     .patch('/api/v1/ticket-revenues/me')
  //     .auth(apiToken, {
  //       type: 'bearer',
  //     })
  //     .send(requestArgs)
  //     .expect(200)
  //     .then(({ body }) => {
  //       ticketRevenuesMe = body;
  //     });
  // });
});
