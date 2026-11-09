import { HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { Client } from 'pg';
import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';

/**
 * Rota v2 paralela do Relatório Consolidado Permissionário (ADR 0022, fatia 1).
 * Contrato HTTP só - paridade de valor já é coberta pelos specs de integração de T3/T4
 * (vanzeiro-aggregator.service.integration.spec.ts, consorcio-aggregator.service.integration.spec.ts).
 * Requer uma API rodando em APP_URL apontando para um banco de teste (nunca o banco local).
 */

const BASE = '/api/v2/cnab/relatorio-novo-remessa';

// Distinct id range from the other e2e specs in this directory, to avoid cross-contamination.
const BASE_ID = 993000000;
const USER_ID = BASE_ID + 1;

const db = () =>
  new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

describe('Relatório Consolidado v2 (e2e)', () => {
  let token: string;
  let client: Client;

  const get = (params: Record<string, string | number | boolean>, overrideToken?: string) =>
    request(APP_URL)
      .get(`${BASE}/consolidado`)
      .set('Authorization', `Bearer ${overrideToken ?? token}`)
      .query(params);

  beforeAll(async () => {
    client = db();
    await client.connect();

    const login = await request(APP_URL)
      .post('/api/v1/auth/admin/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(HttpStatus.OK);
    token = login.body.token;

    await client.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'PERMISSIONARIO CONSOLIDADO V2 E2E', 1, '99999999801',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [USER_ID, `consolidado-v2-e2e-${USER_ID}@example.test`],
    );

    // nomeConsorcio precisa ser um modal reconhecido (STPC/STPL/TEC) - o filtro default da
    // rota, sem consorcioNome/todosConsorcios explicito, restringe a "nunca_enviada" aos modais
    // (ADR 2026-11-04/MODAIS_FILTER, base-pagamento.repository.ts:resolveConsorcioFilter).
    await client.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2095-07-10', DATE '2095-07-10', 456, now(), $2, 'STPC', NULL, now(), now())`,
      [BASE_ID + 40, USER_ID],
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM ordem_pagamento WHERE id = $1`, [BASE_ID + 40]);
    await client.query(`DELETE FROM public."user" WHERE id = $1`, [USER_ID]);
    await client?.end();
  });

  it('returns 200 with the A Pagar favorecido total for a known fixture', async () => {
    const res = await get({
      dataInicio: '2095-07-10',
      dataFim: '2095-07-10',
      aPagar: true,
    }).expect(HttpStatus.OK);

    expect(res.body).toEqual(
      expect.objectContaining({
        count: expect.any(Number),
        valor: expect.any(Number),
        valorAPagar: expect.any(Number),
        data: expect.arrayContaining([
          expect.objectContaining({ nomefavorecido: 'PERMISSIONARIO CONSOLIDADO V2 E2E', valor: 456 }),
        ]),
      }),
    );
  });

  it('returns 401 without a token', async () => {
    await request(APP_URL)
      .get(`${BASE}/consolidado`)
      .query({ dataInicio: '2095-07-10', dataFim: '2095-07-10' })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns 400 for an out-of-scope parameter (eleicao)', async () => {
    await get({
      dataInicio: '2095-07-10',
      dataFim: '2095-07-10',
      eleicao: true,
    }).expect(HttpStatus.BAD_REQUEST);
  });
});
