import { isFriday, nextFriday } from 'date-fns';
import * as request from 'supertest';
import { getDateYMDString } from '../../src/utils/date-utils';
import { configE2E } from '../utils/config';
import {
  APP_URL,
  LICENSEE_PASSWORD,
  LICENSEE_PERMIT_CODE,
} from '../utils/constants';

configE2E();

/**
 * @see {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 Requirements - GitHub}
 */
describe('Bank statements (e2e)', () => {
  const app = APP_URL;
  let apiToken;

  beforeAll(async () => {
    await request(app)
      .post('/api/v1/auth/licensee/login')
      .send({ permitCode: LICENSEE_PERMIT_CODE, password: LICENSEE_PASSWORD })
      .expect(200)
      .then(({ body }) => {
        apiToken = body.token;
      });
  });
  it('Should /bank-statements todaySum match in /ticket-revenues/me', async () => {
    // Arrange
    let friday = new Date();
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }
    friday.setDate(friday.getDate() - 7);
    const fridayStr = getDateYMDString(friday);

    // Act
    const requestArgs = {
      timeInterval: 'lastMonth',
    };
    let bankStatements;
    await request(app)
      .get('/api/v1/bank-statements/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query(requestArgs)
      .expect(200)
      .then(({ body }) => {
        bankStatements = body;
      });

    let ticketRevenuesMe;
    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        endDate: fridayStr,
      })
      .expect(200)
      .then(({ body }) => {
        ticketRevenuesMe = body;
      });

    // Assert
    expect(bankStatements.todaySum).toEqual(ticketRevenuesMe.todaySum);
  }, 60000);

  it('Should /bank-statements amountSum match /ticket-revenues/me in the same month', async () => {
    // Arrange
    let friday = new Date();
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }

    // Act
    let bankStatements;
    await request(app)
      .get('/api/v1/bank-statements/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({ timeInterval: 'lastMonth' })
      .expect(200)
      .then(({ body }) => {
        bankStatements = body;
      });

    const bsStartFriday =
      bankStatements.data[bankStatements.data.length - 1].date;
    const bsStartDate = new Date(bsStartFriday);
    bsStartDate.setDate(bsStartDate.getDate() - 8);
    const bsEndDate = new Date(bankStatements.data[0].date);
    bsEndDate.setDate(bsEndDate.getDate() - 2);

    let ticketRevenuesMe;
    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        startDate: getDateYMDString(bsStartDate),
        endDate: getDateYMDString(bsEndDate),
      })
      .expect(200)
      .then(({ body }) => {
        ticketRevenuesMe = body;
      });

    // Assert
    friday.setDate(friday.getDate());
    expect(bankStatements.amountSum).toEqual(ticketRevenuesMe.amountSum);
  }, 60000);

  it('Should match amountSum in /bank-statements and /ticket-revenues/me of same week', async () => {
    // Arrange
    let friday = new Date();
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }
    friday.setDate(friday.getDate() - 7);
    const fridayStr = getDateYMDString(friday);

    // Act
    const requestArgs = {
      timeInterval: 'lastMonth',
    };
    let bankStatements;
    await request(app)
      .get('/api/v1/bank-statements/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query(requestArgs)
      .expect(200)
      .then(({ body }) => {
        bankStatements = body;
      });

    let ticketRevenuesMe;
    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        endDate: fridayStr,
      })
      .expect(200)
      .then(({ body }) => {
        ticketRevenuesMe = body;
      });

    // Assert
    const bsFriday = bankStatements.data.filter(
      (i: any) => i.date === fridayStr,
    )?.[0];
    expect(bsFriday.amount).toEqual(ticketRevenuesMe.amountSum);
  }, 60000);
});