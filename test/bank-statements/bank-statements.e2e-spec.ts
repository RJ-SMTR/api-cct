import { BigQuery } from '@google-cloud/bigquery';
import { isFriday, nextFriday, previousFriday } from 'date-fns';
import * as request from 'supertest';
import { getDateYMDString } from '../../src/utils/date-utils';
import {
  APP_URL,
  BQ_JSON_CREDENTIALS,
  LICENSEE_CPF_PASSWORD,
  LICENSEE_CPF_PERMIT_CODE,
} from '../utils/constants';

describe('Bank statements (e2e)', () => {
  const app = APP_URL;
  let apiToken: any;
  let bq: BigQuery;
  let licenseeCpfCnpj: string;

  /**
   * Sample date found at 2024/01/25:
   * max: 2023-10-30, min: 2023-10-19
   */
  let licenseeMaxDate: Date;

  beforeAll(async () => {
    await request(app)
      .post('/api/v1/auth/licensee/login')
      .send({
        permitCode: LICENSEE_CPF_PERMIT_CODE,
        password: LICENSEE_CPF_PASSWORD,
      })
      .expect(200)
      .then(({ body }) => {
        apiToken = body.token;
        licenseeCpfCnpj = body.user.cpfCnpj;
      });

    bq = new BigQuery({ credentials: BQ_JSON_CREDENTIALS() });
    await bq
      .query(
        `
SELECT
  CAST(t.data AS STRING) AS partitionDate,
  FROM \`rj-smtr-dev.br_rj_riodejaneiro_bilhetagem_cct.transacao\` t
  LEFT JOIN \`rj-smtr.cadastro.operadoras\` o ON o.id_operadora = t.id_operadora
WHERE o.documento = '${licenseeCpfCnpj}' ORDER BY data DESC, hora DESC LIMIT 1
    `,
      )
      .then((value) => {
        licenseeMaxDate = new Date(value[0][0]?.['partitionDate']);
      });
    expect(Number(licenseeMaxDate)).not.toBeNaN();
  }, 60000);

  it('should match todaySum in /bank-statements with /ticket-revenues/me', async () => {
    // Arrange
    let friday = new Date(licenseeMaxDate);
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const fridayStr = getDateYMDString(friday);

    // Act
    let bankStatements: any;
    await request(app)
      .get('/api/v1/bank-statements/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        endDate: getDateYMDString(friday),
        timeInterval: 'lastMonth',
      })
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
    expect(bankStatements.data.length).toBeGreaterThan(0);
    expect(ticketRevenuesMe.data.length).toBeGreaterThan(0);
  }, 60000);

  it('should match amountSum in /bank-statements with /ticket-revenues/me in the same month', /**
   * Requirement: 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 8 - GitHub}
   */ async () => {
    // Arrange
    let friday = new Date(licenseeMaxDate);
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
      .query({
        endDate: getDateYMDString(friday),
        timeInterval: 'lastMonth',
      })
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
    expect(bankStatements.amountSum).toEqual(ticketRevenuesMe.amountSum);
    expect(bankStatements.data.length).toBeGreaterThan(0);
    expect(ticketRevenuesMe.data.length).toBeGreaterThan(0);
    expect(bankStatements.amountSum).toBeGreaterThan(0);
    expect(ticketRevenuesMe.amountSum).toBeGreaterThan(0);
  }, 60000);

  it('should match amountSum in /bank-statements with /ticket-revenues/me in the same week', /**
   * Requirement: 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 7 - GitHub}
   */ async () => {
    // Arrange
    let friday = new Date(licenseeMaxDate);
    if (!isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const fridayStr = getDateYMDString(friday);

    // Act
    let bankStatements;
    await request(app)
      .get('/api/v1/bank-statements/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        endDate: fridayStr,
        timeInterval: 'lastMonth',
      })
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
    expect(bankStatementsFriday).toBeDefined();
    expect(ticketRevenuesMe.data.length).toBeGreaterThan(0);
    // expect(bankStatementsFriday.amount).toBeGreaterThan(0);
    // expect(ticketRevenuesMe.amountSum).toBeGreaterThan(0);
    expect(bankStatementsFriday.amount).toEqual(ticketRevenuesMe.amountSum);
  }, 60000);

  it('should match amounts per category in /ticket-revenues/me vs ticket-revenues/grouped/me', /**
   * Requirement: 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 9 - GitHub}
   */ async () => {
    // Arrange
    let friday = new Date(licenseeMaxDate);
    if (!isFriday(friday)) {
      friday = previousFriday(friday);
    }

    // Act
    let revenuesMe: any;
    await request(app)
      .get('/api/v1/ticket-revenues/me')
      .auth(apiToken, {
        type: 'bearer',
      })
      .query({
        endDate: getDateYMDString(friday),
        timeInterval: 'lastWeek',
      })
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
      .query({
        endDate: getDateYMDString(friday),
        timeInterval: 'lastWeek',
      })
      .expect(200)
      .then(({ body }) => {
        revenuesMeGrouped = body;
      });

    // Assert
    const transactionTypeSum = Number(
      (revenuesMe.data as [])
        .reduce(
          (sum, i: any) =>
            sum + i?.transactionTypeCounts?.['Débito']?.transactionValue || 0,
          0,
        )
        .toFixed(2),
    );
    const transportTypeSum = Number(
      (revenuesMe.data as [])
        .reduce(
          (sum, i: any) =>
            sum + i?.transportTypeCounts?.['Van']?.transactionValue || 0,
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
    // expect(
    //   transactionTypeSum || transportTypeSum || transportIntegrationSum,
    // ).toBeGreaterThan(0);
    expect(
      revenuesMeGrouped.transactionTypeCounts?.['Débito']?.transactionValue ||
        0,
    ).toEqual(transactionTypeSum);
    expect(
      revenuesMeGrouped.transportTypeCounts?.['Van']?.transactionValue || 0,
    ).toEqual(transportTypeSum);
    expect(
      revenuesMeGrouped.transportIntegrationTypeCounts?.['BRT']
        ?.transactionValue || 0,
    ).toEqual(transportIntegrationSum);
  }, 60000);

  it('should match amountSum in /bank-statements/me with transactionValueSum in ticket-revenues/grouped/me', /**
   * Requirement: 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item 10 - GitHub}
   */ async () => {
    // Arrange
    let friday = new Date(licenseeMaxDate);
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
      .query({
        endDate: getDateYMDString(friday),
        timeInterval: 'lastMonth',
      })
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
      .query({
        endDate: getDateYMDString(friday),
        timeInterval: 'lastMonth',
      })
      .expect(200)
      .then(({ body }) => {
        revenuesMeGrouped = body;
      });

    // Assert
    expect(bankStatements.amountSum).toBeGreaterThan(0);
    expect(revenuesMeGrouped.transactionValueSum).toBeGreaterThan(0);
    expect(bankStatements.amountSum).toEqual(
      revenuesMeGrouped.transactionValueSum,
    );
  }, 60000);

  it('should match ticketCounts in /bank-statements with counts in ticket-revenues/grouped/me', /**
   * Requirement: 2023/11/10 {@link https://github.com/RJ-SMTR/api-cct/issues/80#issuecomment-1806153475 #80, item ?? - GitHub}
   */ async () => {
    // Arrange
    let friday = new Date(licenseeMaxDate);
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
      .query({
        endDate: getDateYMDString(friday),
        timeInterval: 'lastMonth',
      })
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
      .query({
        endDate: getDateYMDString(friday),
        timeInterval: 'lastMonth',
      })
      .expect(200)
      .then(({ body }) => {
        revenuesMeGrouped = body;
      });

    // Assert
    expect(bankStatements.ticketCount).toBeGreaterThan(0);
    expect(revenuesMeGrouped.count).toBeGreaterThan(0);
    expect(bankStatements.ticketCount).toEqual(revenuesMeGrouped.count);
  }, 60000);
});
