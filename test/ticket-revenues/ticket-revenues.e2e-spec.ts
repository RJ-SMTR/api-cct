import { subDays } from 'date-fns';
import * as request from 'supertest';
import { getDateYMDString } from '../../src/utils/date-utils';
import {
  APP_URL,
  LICENSEE_PASSWORD,
  LICENSEE_PERMIT_CODE,
} from '../utils/constants';

describe('Ticket revenues (e2e)', () => {
  const app = APP_URL;
  let apiToken: any;

  beforeAll(async () => {
    await request(app)
      .post('/api/v1/auth/licensee/login')
      .send({ permitCode: LICENSEE_PERMIT_CODE, password: LICENSEE_PASSWORD })
      .expect(200)
      .then(({ body }) => {
        apiToken = body.token;
      });
  });

  it('should return some user result in /ticket-revenues/me', async () => {
    // Arrange
    const startDate = subDays(new Date(), 366);

    // Act
    let ticketRevenuesMe: any;
    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        startDate: getDateYMDString(startDate),
        endDate: getDateYMDString(new Date()),
      })
      .expect(200)
      .then(({ body }) => {
        ticketRevenuesMe = body;
      });

    // Assert
    expect(ticketRevenuesMe.data.length).toBeGreaterThan(0);
  }, 60000);
});
