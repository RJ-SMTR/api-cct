import { subDays } from 'date-fns';
import * as request from 'supertest';
import { getDateYMDString } from '../../src/utils/date-utils';
import {
  APP_URL,
  LICENSEE_CNPJ_PASSWORD,
  LICENSEE_CNPJ_PERMIT_CODE,
  LICENSEE_CPF_PASSWORD,
  LICENSEE_CPF_PERMIT_CODE,
} from '../utils/constants';

describe('Ticket revenues (e2e)', () => {
  const app = APP_URL;
  let cpfApiToken: any;
  let cnpjApiToken: any;

  beforeAll(async () => {
    await request(app)
      .post('/api/v1/auth/licensee/login')
      .send({
        permitCode: LICENSEE_CPF_PERMIT_CODE,
        password: LICENSEE_CPF_PASSWORD,
      })
      .expect(200)
      .then(({ body }) => {
        cpfApiToken = body.token;
      });
    await request(app)
      .post('/api/v1/auth/licensee/login')
      .send({
        permitCode: LICENSEE_CNPJ_PERMIT_CODE,
        password: LICENSEE_CNPJ_PASSWORD,
      })
      .expect(200)
      .then(({ body }) => {
        cnpjApiToken = body.token;
      });
  });

  it('should match result in /ticket-revenues/me with /ticket-revenues/me/individual', /**
   * Requirement: 2024/01/26 {@link https://github.com/RJ-SMTR/api-cct/issues/167#issuecomment-1912764312 #167, item 3 - GitHub}
   */ async () => {
    // Arrange
    const startDate = subDays(new Date(), 366);

    // Act
    let ticketRevenuesMe: any;
    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(cpfApiToken, {
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
      .auth(cpfApiToken, {
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

  it('should fetch successfully CNPJ user at /ticket-revenues/me', /**
   * Requirement: 2024/01/26 {@link https://github.com/RJ-SMTR/api-cct/issues/167#issuecomment-1912764312 #167, item 4 - GitHub}
   */ async () => {
    // Arrange
    const startDate = subDays(new Date(), 366);

    // Act
    let ticketRevenuesMe: any;
    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(cnpjApiToken, {
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
