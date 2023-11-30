import {
  isFriday,
  isSameMonth,
  nextFriday,
  previousFriday,
  startOfMonth,
} from 'date-fns';
import { getDateYMDString } from 'src/utils/date-utils';
import * as request from 'supertest';
import {
  APP_URL,
  LICENSEE_PASSWORD,
  LICENSEE_PERMIT_CODE,
} from '../../test/utils/constants';
/**
 * @see {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 Requirements - GitHub}
 */
describe('Ticket revenues (e2e)', () => {
  const app = APP_URL;
  let apiToken;
  function getMonthStartDateStr(oldDate: Date): string {
    let newDate = startOfMonth(oldDate);
    if (!isFriday(newDate)) {
      newDate = nextFriday(newDate);
    }
    newDate.setDate(newDate.getDate() - 8);
    return getDateYMDString(newDate);
  }
  function getPreviousDateStr(oldDate: Date, daysBefore: number): string {
    const newDate = new Date(oldDate);
    newDate.setDate(newDate.getDate() - daysBefore);
    return getDateYMDString(newDate);
  }
  function getNowFriday(): Date {
    const nowDate = new Date(Date.now());
    let nowFriday = nextFriday(nowDate);
    if (!isSameMonth(nowDate, nowFriday)) {
      nowFriday = previousFriday(nowDate);
    }
    return nowFriday;
  }

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

  it('Should match startDate, endDate in /ticket-revenues/me when passed timeInterval = last month, with/without endDate', async () => {
    // Arrange
    const nowDate = new Date(Date.now());
    const nowFriday = getNowFriday();
    const ticketIntervalEndDate: any = {
      expectedStartDate: getMonthStartDateStr(nowDate),
      expectedEndDate: getPreviousDateStr(nowFriday, 9),
    };
    const ticketInterval: any = {
      expectedStartDate: getMonthStartDateStr(nowDate),
      expectedEndDate: getPreviousDateStr(nowFriday, 2),
    };

    // Act
    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        timeInterval: 'lastMonth',
        // endDate should be ignored
        endDate: getPreviousDateStr(nowFriday, 10),
      })
      .expect(200)
      .then(({ body }) => {
        ticketIntervalEndDate.response = body;
      });

    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({ timeInterval: 'lastMonth' })
      .expect(200)
      .then(({ body }) => {
        ticketInterval.response = body;
      });

    // Assert
    expect(ticketIntervalEndDate.expectedStartDate).toEqual(
      ticketIntervalEndDate.response.startDate,
    );
    expect(ticketIntervalEndDate.expectedEndDate).toEqual(
      ticketIntervalEndDate.response.endDate,
    );
    expect(ticketInterval.expectedStartDate).toEqual(
      ticketInterval.response.startDate,
    );
    expect(ticketInterval.expectedEndDate).toEqual(
      ticketInterval.response.endDate,
    );
  }, 60000);

  it('Should match startDate, endDate in /ticket-revenues/me when passed timeInterval = last 2 weeks', async () => {
    // Arrange
    const nowFriday = getNowFriday();
    const expectedStartDate = getPreviousDateStr(nowFriday, 15);
    const expectedEndDate = getPreviousDateStr(nowFriday, 2);

    // Act
    let ticketMe: any = {};

    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({ timeInterval: 'last2Weeks' })
      .expect(200)
      .then(({ body }) => {
        ticketMe = body;
      });

    // Assert
    expect(expectedStartDate).toEqual(ticketMe.startDate);
    expect(expectedEndDate).toEqual(ticketMe.endDate);
  }, 60000);

  it('Should match startDate, endDate in /ticket-revenues/me when passed timeInterval = last week', async () => {
    // Arrange
    const nowFriday = getNowFriday();
    const expectedStartDate = getPreviousDateStr(nowFriday, 8);
    const expectedEndDate = getPreviousDateStr(nowFriday, 2);

    // Act
    let ticketMe: any = {};

    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({ timeInterval: 'lastWeek' })
      .expect(200)
      .then(({ body }) => {
        ticketMe = body;
      });

    // Assert
    expect(expectedStartDate).toEqual(ticketMe.startDate);
    expect(expectedEndDate).toEqual(ticketMe.endDate);
  }, 60000);

  it('Should match startDate, endDate in /ticket-revenues/me when passed startDate, endDate', async () => {
    // Arrange
    const nowFriday = getNowFriday();
    const expectedStartDate = getPreviousDateStr(nowFriday, 8);
    const expectedEndDate = getPreviousDateStr(nowFriday, 2);

    // Act
    let ticketMe: any = {};

    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        startDate: expectedStartDate,
        endDate: expectedEndDate,
      })
      .expect(200)
      .then(({ body }) => {
        ticketMe = body;
      });

    // Assert
    expect(expectedStartDate).toEqual(ticketMe.startDate);
    expect(expectedEndDate).toEqual(ticketMe.endDate);
  }, 60000);
});
