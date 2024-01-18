import { isFriday, isSameMonth, nextFriday, previousFriday } from 'date-fns';
import * as request from 'supertest';
import { getDateYMDString } from '../../src/utils/date-utils';
import {
  APP_URL,
  LICENSEE_PASSWORD,
  LICENSEE_PERMIT_CODE,
} from '../utils/constants';

describe('Bank statements (e2e)', () => {
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

  describe('Setup tests', () => {
    test('timezone should be UTC', () => {
      expect(new Date().getTimezoneOffset()).toBe(0);
    });
  });

  it('Should match todaySum in /bank-statements with /ticket-revenues/me', async () => {
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
    let bankStatements: any;
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

    let ticketRevenuesMe: any;
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

  it('Should match amountSum in /bank-statements with /ticket-revenues/me in the same month', /**
   * Requirements:
   * - 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 8 - GitHub}
   */ async () => {
    // Arrange
    let friday = new Date();
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }

    // Act
    let bankStatements: any;
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

    let ticketRevenuesMe: any;
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

  it('Should match amountSum in /bank-statements with /ticket-revenues/me in the same week', /**
   * Requirements:
   * - 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 7 - GitHub}
   */ async () => {
    // Arrange
    let friday = new Date();
    if (isSameMonth(friday, nextFriday(friday))) {
      friday = nextFriday(friday);
    } else {
      friday = previousFriday(friday);
    }
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
    const bankStatementsFriday = bankStatements.data.filter(
      (i: any) => i.date === fridayStr,
    )?.[0];
    expect(bankStatements.data[0].date).toEqual(fridayStr);
    expect(bankStatementsFriday.amount).toEqual(ticketRevenuesMe.amountSum);
  }, 60000);

  it('Should match amounts per category in /ticket-revenues/me vs ticket-revenues/grouped/me', /**
   * Requirements:
   * - 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 9 - GitHub}
   */ async () => {
    // Arrange
    const requestArgs = {
      timeInterval: 'lastWeek',
    };

    // Act
    let revenuesMe: any;
    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query(requestArgs)
      .expect(200)
      .then(({ body }) => {
        revenuesMe = body;
      });

    let revenuesMeGrouped: any;
    await request(app)
      .get('/api/v1/ticket-revenues/me/grouped')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query(requestArgs)
      .expect(200)
      .then(({ body }) => {
        revenuesMeGrouped = body;
      });

    // Assert
    const transactionTypeSum = Number(
      (revenuesMe.data as [])
        .reduce(
          (sum, i: any) =>
            sum + i?.transactionTypeCounts?.['Integração']?.transactionValue ||
            0,
          0,
        )
        .toFixed(2),
    );
    const transportTypeSum = Number(
      (revenuesMe.data as [])
        .reduce(
          (sum, i: any) =>
            sum + i?.transportTypeCounts?.['1']?.transactionValue || 0,
          0,
        )
        .toFixed(2),
    );
    const transportIntegrationSum = Number(
      (revenuesMe.data as [])
        .reduce(
          (sum, i: any) =>
            sum +
              i?.transportIntegrationTypeCounts?.['BRT']?.transactionValue || 0,
          0,
        )
        .toFixed(2),
    );
    expect(
      revenuesMeGrouped.transactionTypeCounts?.['Integração']
        ?.transactionValue || 0,
    ).toEqual(transactionTypeSum);
    expect(
      revenuesMeGrouped.transportTypeCounts?.['1']?.transactionValue || 0,
    ).toEqual(transportTypeSum);
    expect(
      revenuesMeGrouped.transportIntegrationTypeCounts?.['BRT']
        ?.transactionValue || 0,
    ).toEqual(transportIntegrationSum);
  }, 60000);

  it('Should match amountSum in /bank-statements/me with transactionValueSum in ticket-revenues/grouped/me', /**
   * Requirements:
   * - 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 10 - GitHub}
   */ async () => {
    // Arrange
    const requestArgs = {
      timeInterval: 'lastMonth',
    };

    // Act
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

    let revenuesMeGrouped;
    await request(app)
      .get('/api/v1/ticket-revenues/me/grouped')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query(requestArgs)
      .expect(200)
      .then(({ body }) => {
        revenuesMeGrouped = body;
      });

    // Assert
    expect(bankStatements.amountSum).toEqual(
      revenuesMeGrouped.transactionValueSum,
    );
  }, 60000);

  it('Should match ticketCounts in /bank-statements with counts in ticket-revenues/grouped/me', /**
   * Requirements:
   * - 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item ?? - GitHub}
   */ async () => {
    // Arrange
    const requestArgs = {
      timeInterval: 'lastMonth',
    };

    // Act
    let bankStatements: any;
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

    let revenuesMeGrouped: any;
    await request(app)
      .get('/api/v1/ticket-revenues/me/grouped')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query(requestArgs)
      .expect(200)
      .then(({ body }) => {
        revenuesMeGrouped = body;
      });

    // Assert
    expect(bankStatements.ticketCount).toEqual(revenuesMeGrouped.count);
  }, 60000);
});
