import { HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { Client } from 'pg';
import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';

/**
 * Rotas v2 do Consolidado (fatia 2), ponta a ponta contra a aplicacao completa: Pendencia Paga,
 * Pendencia de Pagamento, Eleicao e STUC-Gratuidade no Permissionario, e a rota nova de Guardador.
 * Os specs de integracao de consolidado-v2 ja provam os totais; este prova o fio HTTP.
 *
 * Requer uma API rodando em APP_URL apontando para um banco de teste descartavel.
 */

const V2 = '/api/v2/cnab/relatorio-novo-remessa';
const PERM = `${V2}/consolidado`;
const GUARD = `${V2}/guardador/consolidado`;

const BASE_ID = 988000000;
const PERM_USER_ID = BASE_ID + 1;
const GUARD_USER_ID = BASE_ID + 2;
const ELEICAO_USER_ID = BASE_ID + 3;
const STUC_USER_ID = BASE_ID + 4;
const USER_IDS = [PERM_USER_ID, GUARD_USER_ID, ELEICAO_USER_ID, STUC_USER_ID];
const ELEICAO_PERMIT_CODE = '988000003';

const db = () =>
  new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

describe('Rotas v2 do Consolidado, fatia 2 (e2e)', () => {
  let token: string;
  let client: Client;

  const get = (path: string, params: Record<string, string | number | boolean>) =>
    request(APP_URL).get(path).set('Authorization', `Bearer ${token}`).query(params);

  async function cleanup(): Promise<void> {
    const range = [BASE_ID, BASE_ID + 999999];
    await client.query(`DELETE FROM ordem_pagamento_unico WHERE id BETWEEN $1 AND $2`, range);
    await client.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, range);
    await client.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, range);
    await client.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, range);
    await client.query(`DELETE FROM ordem_pagamento_guardador WHERE id BETWEEN $1 AND $2`, range);
    await client.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, range);
    await client.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, range);
    await client.query(`DELETE FROM public."user" WHERE id = ANY($1)`, [USER_IDS]);
  }

  async function seedUser(id: number, nome: string, roleId: number, cpfCnpj: string, permitCode: string | null = null): Promise<void> {
    await client.query(
      `INSERT INTO public."user" (id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode", "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado, "createdAt", "updatedAt")
       VALUES ($1, $2, 'email', $3, $4, $5, $6, 104, '0001', '99990002', '1', false, now(), now())`,
      [id, `consolidado-v2-fatia2-${id}@example.test`, nome, roleId, cpfCnpj, permitCode],
    );
  }

  async function seedAgrupado(id: number, dataPagamento: string, valor: number, paiId: number | null = null): Promise<void> {
    await client.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, $4, now(), now())`,
      [id, dataPagamento, valor, paiId],
    );
  }

  async function seedHistorico(id: number, opaId: number, data: string, status: number, motivo: string | null): Promise<void> {
    await client.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', $4, $5)`,
      [id, opaId, data, status, motivo],
    );
  }

  async function seedDetalhe(id: number, historicoId: number, vencimento: string, valor: number): Promise<void> {
    await client.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $1, $3::date, $4, $4, $1, now(), now())`,
      [id, historicoId, vencimento, valor],
    );
  }

  async function seedPendenciaPaga(): Promise<void> {
    const paiId = BASE_ID + 100;
    const filhaId = BASE_ID + 101;
    await seedAgrupado(paiId, '2094-05-10', 500);
    await seedAgrupado(filhaId, '2094-01-01', 500, paiId);
    await client.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2094-01-01', 500, now(), $2, 'STPC', $3, now(), now())`,
      [BASE_ID + 102, PERM_USER_ID, filhaId],
    );
    await seedHistorico(BASE_ID + 103, filhaId, '2094-01-01', 5, null);
    await seedDetalhe(BASE_ID + 104, BASE_ID + 103, '2094-01-01', 500);
  }

  async function seedGuardadorPago(): Promise<void> {
    const opaId = BASE_ID + 200;
    await seedAgrupado(opaId, '2094-05-20', 200);
    await client.query(
      `INSERT INTO ordem_pagamento_guardador (id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId", "tipoOrdemPagamento", "ordemPagamentoAgrupadoId", "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida", "createdAt", "updatedAt")
       VALUES ($1, DATE '2094-05-15', DATE '2094-05-15', 200, $2, 'AUTOMATICA', $3, 0, 0, 0, now(), now())`,
      [BASE_ID + 201, GUARD_USER_ID, opaId],
    );
    await seedHistorico(BASE_ID + 202, opaId, '2094-05-20', 3, '00');
    await seedDetalhe(BASE_ID + 203, BASE_ID + 202, '2094-05-20', 200);
  }

  async function seedEleicao(): Promise<void> {
    const opaId = BASE_ID + 300;
    await seedAgrupado(opaId, '2094-06-10', 250);
    await seedHistorico(BASE_ID + 301, opaId, '2094-06-10', 3, '00');
    await seedDetalhe(BASE_ID + 302, BASE_ID + 301, '2094-06-10', 250);
    await client.query(
      `INSERT INTO ordem_pagamento_unico (id, "idOrdemPagamento", "idOperadora", "operadoraCpfCnpj", "consorcio", "dataOrdem")
       VALUES ($1, $2, $3, NULL, 'VLT', DATE '2094-06-10')`,
      [BASE_ID + 303, String(opaId), ELEICAO_PERMIT_CODE],
    );
  }

  // Janelas de STUC sao fixas por dia da semana: sexta a segunda, pagas na terca. 2097-10-11 e' sexta.
  async function seedStuc(): Promise<void> {
    const opaId = BASE_ID + 400;
    await seedAgrupado(opaId, '2097-10-15', 50);
    await seedHistorico(BASE_ID + 401, opaId, '2097-10-15', 3, '00');
    await seedDetalhe(BASE_ID + 402, BASE_ID + 401, '2097-10-15', 50);

    const dias = ['2097-10-11', '2097-10-12', '2097-10-13', '2097-10-14'];
    const valores = [5, 10, 15, 20];
    for (let i = 0; i < dias.length; i++) {
      await client.query(
        `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "valorGratuidade", "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoGratuidadeId", "createdAt", "updatedAt")
         VALUES ($1, $2::date, $3, $3, now(), $4, 'STUC E2E FATIA 2', $5, now(), now())`,
        [BASE_ID + 410 + i, dias[i], valores[i], STUC_USER_ID, opaId],
      );
    }
  }

  beforeAll(async () => {
    client = db();
    await client.connect();

    const login = await request(APP_URL).post('/api/v1/auth/admin/email/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }).expect(HttpStatus.OK);
    token = login.body.token;

    await cleanup();
    await client.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
    await seedUser(PERM_USER_ID, 'PERMISSIONARIO E2E FATIA 2', 1, '99999999881');
    await seedUser(GUARD_USER_ID, 'GUARDADOR E2E FATIA 2', 6, '99999999882');
    await seedUser(ELEICAO_USER_ID, 'ELEICAO E2E FATIA 2', 1, '99999999883', ELEICAO_PERMIT_CODE);
    await seedUser(STUC_USER_ID, 'STUC E2E FATIA 2', 1, '99999999884');
    await seedPendenciaPaga();
    await seedGuardadorPago();
    await seedEleicao();
    await seedStuc();
  }, 30000);

  afterAll(async () => {
    await cleanup();
    await client?.end();
  });

  it('pendenciaPaga=true devolve o total da familia pela data do pai', async () => {
    const res = await get(PERM, { dataInicio: '2094-05-10', dataFim: '2094-05-10', pendenciaPaga: true }).expect(HttpStatus.OK);

    expect(res.body.valor).toBe(500);
    expect(res.body.data).toHaveLength(1);
  });

  it('rejeitado=true&estorno=true responde 200', async () => {
    const res = await get(PERM, { dataInicio: '2094-05-10', dataFim: '2094-05-10', rejeitado: true, estorno: true }).expect(HttpStatus.OK);

    expect(res.body).toEqual(expect.objectContaining({ data: expect.any(Array) }));
  });

  it('eleicao=true devolve a visao por favorecido', async () => {
    const res = await get(PERM, { dataInicio: '2094-06-10', dataFim: '2094-06-10', eleicao: true }).expect(HttpStatus.OK);

    expect(res.body.valor).toBe(250);
    expect(res.body.data).toHaveLength(1);
  });

  it('eleicao=true&todosConsorcios=true devolve a visao por consorcio', async () => {
    const res = await get(PERM, { dataInicio: '2094-06-10', dataFim: '2094-06-10', eleicao: true, todosConsorcios: true }).expect(HttpStatus.OK);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nomefavorecido).toBe('VLT');
    expect(res.body.valor).toBe(250);
  });

  it('eleicao=true em periodo sem ordens responde 200 com lista vazia', async () => {
    const res = await get(PERM, { dataInicio: '2094-07-10', dataFim: '2094-07-10', eleicao: true }).expect(HttpStatus.OK);

    expect(res.body.data).toEqual([]);
  });

  it('stucGratuidade=true devolve as quatro datas da janela no shape', async () => {
    const res = await get(PERM, { dataInicio: '2097-10-15', dataFim: '2097-10-15', stucGratuidade: true }).expect(HttpStatus.OK);

    expect(res.body.data).toHaveLength(1);
    for (const campo of ['dataOrdemPagamento1', 'dataOrdemPagamento2', 'dataOrdemPagamento3', 'dataOrdemPagamento4']) {
      expect(res.body.data[0]).toHaveProperty(campo);
    }
  });

  it('rota de Guardador com pago=true devolve o total do favorecido', async () => {
    const res = await get(GUARD, { dataInicio: '2094-05-20', dataFim: '2094-05-20', pago: true }).expect(HttpStatus.OK);

    expect(res.body.valor).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it.each([PERM, GUARD])('%s rejeita requisicao sem token (401)', async (path) => {
    await request(APP_URL).get(path).query({ dataInicio: '2094-05-10', dataFim: '2094-05-10' }).expect(HttpStatus.UNAUTHORIZED);
  });

  it.each<[string, string | boolean | number]>([
    ['desativados', true],
    ['pendentes', true],
    ['userIds', 1],
  ])('rota Permissionario rejeita %s com 400', async (parametro, valor) => {
    await get(PERM, { dataInicio: '2094-05-10', dataFim: '2094-05-10', [parametro]: valor }).expect(HttpStatus.BAD_REQUEST);
  });

  it('rota de Guardador rejeita consorcioNome com 400', async () => {
    await get(GUARD, { dataInicio: '2094-05-10', dataFim: '2094-05-10', consorcioNome: 'STPC' }).expect(HttpStatus.BAD_REQUEST);
  });
});
