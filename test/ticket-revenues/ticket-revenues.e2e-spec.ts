import * as request from 'supertest';
import { configE2E } from '../../test/utils/config';
import {
  APP_URL,
  LICENSEE_PASSWORD,
  LICENSEE_PERMIT_CODE,
} from '../../test/utils/constants';

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

  it('Should match amountSum in /ticket-revenues/me and transactionValueSum in ticket-revenues/grouped/me', async () => {
    // Arrange
    const requestArgs = {
      timeInterval: 'lastMonth',
    };

    // Act
    let revenuesMe;
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
    expect(revenuesMe.amountSum).toEqual(revenuesMeGrouped.transactionValueSum);
  }, 60000);
});
