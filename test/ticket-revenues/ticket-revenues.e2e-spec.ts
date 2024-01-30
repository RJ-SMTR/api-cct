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

  it('should match result in /ticket-revenues/me with /ticket-revenues/me/individual', /**
   * Requirements:
   * - 2024/01/26 {@link https://github.com/RJ-SMTR/api-cct/issues/167#issuecomment-1912764312 #167, item 3 - GitHub}
   */ async () => {
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

    let ticketRevenuesMeIndividual: any;
    await request(app)
      .get('/api/v1/ticket-revenues/me/individual')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        startDate: getDateYMDString(startDate),
        endDate: getDateYMDString(new Date()),
      })
      .expect(200)
      .then(({ body }) => {
        ticketRevenuesMeIndividual = body;
      });

    // Assert
    expect(ticketRevenuesMe.data.length).toBeGreaterThan(0);
    expect(ticketRevenuesMeIndividual.data.length).toBeGreaterThan(0);
    expect(ticketRevenuesMeIndividual.amountSum).toEqual(
      ticketRevenuesMe.amountSum,
    );
  }, 60000);
});
