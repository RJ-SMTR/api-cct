import { HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { Client } from 'pg';
import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';

/**
 * Cenários do relatório de movimentação financeira (Permissionário e Guardador).
 * Cada resposta da API é comparada com uma consulta SQL independente, executada no mesmo banco.
 * Requer uma API rodando em APP_URL apontando para um banco de teste (nunca o banco local).
 */

const BASE = '/api/v1/cnab/relatorio-novo-remessa';

const db = () =>
  new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

const sumRows = (rows: { valor: string | number }[]) =>
  Math.round(rows.reduce((acc, r) => acc + Number(r.valor), 0) * 100) / 100;

// Mesmo critério de ordem paga do relatório: pendência paga pela data de pagamento da ordem
// (ou da ordem pai), sem ordens agrupadas que têm filhas, sem motivos AM/AE.
const SQL_GUARDADOR_PENDENCIA_PAGA = `
  SELECT DISTINCT opa.id, pu."fullName" AS nomes, da."valorLancamento" AS valor
  FROM ordem_pagamento_guardador opg
  INNER JOIN ordem_pagamento_agrupado opa ON opg."ordemPagamentoAgrupadoId" = opa.id
  LEFT JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
  INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
  INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
  INNER JOIN public."user" pu ON pu.id = opg."userId"
  WHERE oph."statusRemessa" = 5
    AND pu."roleId" = 6
    AND opa.id NOT IN (SELECT filha."ordemPagamentoAgrupadoId" FROM ordem_pagamento_agrupado filha WHERE filha."ordemPagamentoAgrupadoId" IS NOT NULL)
    AND (oph."motivoStatusRemessa" NOT IN ('AM','AE') OR oph."motivoStatusRemessa" IS NULL)
    AND (CASE WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN op_pai."dataPagamento" ELSE opa."dataPagamento" END)::date BETWEEN $1::date AND $2::date
`;

const SQL_PERMISSIONARIO_PENDENCIA_PAGA = `
  SELECT DISTINCT opa.id, pu."fullName" AS nomes, da."valorLancamento" AS valor
  FROM ordem_pagamento op
  INNER JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
  LEFT JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
  INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
  INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
  INNER JOIN public."user" pu ON pu.id = op."userId"
  WHERE oph."statusRemessa" = 5
    AND opa.id NOT IN (SELECT filha."ordemPagamentoAgrupadoId" FROM ordem_pagamento_agrupado filha WHERE filha."ordemPagamentoAgrupadoId" IS NOT NULL)
    AND (oph."motivoStatusRemessa" NOT IN ('AM','AE') OR oph."motivoStatusRemessa" IS NULL)
    AND (CASE WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN op_pai."dataPagamento" ELSE opa."dataPagamento" END)::date BETWEEN $1::date AND $2::date
`;

// Pendentes (ordens ainda não agrupadas) com o consórcio padrão da API (STPC, STPL, TEC).
const SQL_PERMISSIONARIO_PENDENTES = `
  SELECT op.id, op.valor AS valor
  FROM ordem_pagamento op
  INNER JOIN public."user" pu ON pu.id = op."userId"
  INNER JOIN bank bc ON bc.code = pu."bankCode"
  WHERE op."ordemPagamentoAgrupadoId" IS NULL
    AND DATE(op."dataOrdem") BETWEEN $1::date AND $2::date
    AND UPPER(TRIM(CASE
      WHEN pu."permitCode" = '8' THEN 'VLT'
      WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
      WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
      WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
      ELSE op."nomeConsorcio"
    END)) IN ('STPC','STPL','TEC')
`;

describe('Relatório de movimentação financeira (e2e)', () => {
  let token: string;
  let client: Client;

  const get = (path: string, params: Record<string, string | number | boolean>) =>
    request(APP_URL)
      .get(`${BASE}${path}`)
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, pageSize: 9999, ...params });

  const sqlRows = async (sql: string, params: string[]) =>
    (await client.query(sql, params)).rows as { valor: string | number }[];

  beforeAll(async () => {
    client = db();
    await client.connect();
    const login = await request(APP_URL)
      .post('/api/v1/auth/admin/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(HttpStatus.OK);
    token = login.body.token;
  });

  afterAll(async () => {
    await client?.end();
  });

  // Cenário 1: Guardador, pendência paga, data única com resultado conhecido.
  it('Guardador / Pendência Paga / 01/10/2026 bate com o SQL', async () => {
    const res = await get('/guardador/report/page', {
      dataInicio: '2026-10-01',
      dataFim: '2026-10-01',
      pendenciaPaga: true,
    }).expect(HttpStatus.OK);

    const expected = await sqlRows(SQL_GUARDADOR_PENDENCIA_PAGA, ['2026-10-01', '2026-10-01']);
    expect(res.body.data.length).toBe(expected.length);
    expect(sumRows(res.body.data)).toBe(sumRows(expected));
  });

  // Cenário 2: Guardador, pendência paga, outra data única (mês anterior).
  it('Guardador / Pendência Paga / 23/09/2026 bate com o SQL', async () => {
    const res = await get('/guardador/report/page', {
      dataInicio: '2026-09-23',
      dataFim: '2026-09-23',
      pendenciaPaga: true,
    }).expect(HttpStatus.OK);

    const expected = await sqlRows(SQL_GUARDADOR_PENDENCIA_PAGA, ['2026-09-23', '2026-09-23']);
    expect(sumRows(res.body.data)).toBe(sumRows(expected));
  });

  // Cenário 3: Guardador sem status, data única: deve trazer o mesmo que com Pendência Paga.
  it('Guardador / sem status / 01/10/2026 traz a pendência paga da data', async () => {
    const res = await get('/guardador/report/page', {
      dataInicio: '2026-10-01',
      dataFim: '2026-10-01',
    }).expect(HttpStatus.OK);

    const expected = await sqlRows(SQL_GUARDADOR_PENDENCIA_PAGA, ['2026-10-01', '2026-10-01']);
    const pagas = (res.body.data as { status: string; valor: string }[]).filter(
      (r) => r.status === 'Pendencia Paga',
    );
    expect(sumRows(pagas)).toBe(sumRows(expected));
  });

  // Cenário 4: Permissionário, pendência paga, data única.
  it('Permissionário / Pendência Paga / 03/09/2026 bate com o SQL', async () => {
    const res = await get('/report/page', {
      dataInicio: '2026-09-03',
      dataFim: '2026-09-03',
      pendenciaPaga: true,
    }).expect(HttpStatus.OK);

    const expected = await sqlRows(SQL_PERMISSIONARIO_PENDENCIA_PAGA, ['2026-09-03', '2026-09-03']);
    expect(sumRows(res.body.data)).toBe(sumRows(expected));
  });

  // Cenário 5: Pendência Paga em intervalo de vários dias é descartada pela API (regra de data única).
  it('Permissionário / Pendência Paga / intervalo não retorna pendência paga', async () => {
    const res = await get('/report/page', {
      dataInicio: '2026-09-01',
      dataFim: '2026-09-30',
      pendenciaPaga: true,
    }).expect(HttpStatus.OK);

    expect(res.body.data.length).toBe(0);
  });

  // Cenário 6: Permissionário, pendentes (motivo OPs atrasadas), intervalo 01/10 a 06/10.
  it('Permissionário / Pendentes / intervalo 01/10 a 06/10 bate com o SQL', async () => {
    const res = await get('/report/page', {
      dataInicio: '2026-10-01',
      dataFim: '2026-10-06',
      pendentes: true,
    }).expect(HttpStatus.OK);

    const expected = await sqlRows(SQL_PERMISSIONARIO_PENDENTES, ['2026-10-01', '2026-10-06']);
    expect(sumRows(res.body.data)).toBe(sumRows(expected));
  });
});
