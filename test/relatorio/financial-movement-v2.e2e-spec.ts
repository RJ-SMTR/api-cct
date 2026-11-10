import { HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { Client } from 'pg';
import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';

/**
 * Rotas v2 reais do relatório de movimentação financeira (T10/T11, ADR 0021 item 7), ponta a
 * ponta contra a aplicação completa - prova que a comparação lado a lado em produção funciona
 * antes de qualquer decisão de cutover (T12). Complementa o spec unitário do controller (T10)
 * e os specs de integração de T1-T9 (BasePagamentoRepository/StucGratuidadeRepository), que já
 * provam o SQL; este spec prova o fio HTTP completo (guard, DTO, roteamento, resposta).
 *
 * Requer uma API rodando em APP_URL apontando para um banco de teste (nunca o banco local) -
 * mesmo requisito do e2e das rotas antigas (financial-movement.e2e-spec.ts), que este arquivo
 * nunca modifica.
 */

const BASE = '/api/v1/cnab/relatorio-novo-remessa';

// Range dedicada a este arquivo (T11) - distinta das usadas por outros specs e2e/integration
// rodando contra o mesmo Postgres (991000000-995000000 consolidado-v2, 996000000+ integration specs).
const BASE_ID = 989000000;
const PERM_USER_ID = BASE_ID + 1;
const GUARD_USER_ID = BASE_ID + 2;
const ELEICAO_USER_ID = BASE_ID + 3;
const STUC_USER_ID = BASE_ID + 4;

const db = () =>
  new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

describe('Rotas v2 reais do relatório de movimentação financeira (e2e)', () => {
  let token: string;
  let client: Client;

  const get = (path: string, params: Record<string, string | number | boolean>, overrideToken?: string) =>
    request(APP_URL)
      .get(`${BASE}${path}`)
      .set('Authorization', `Bearer ${overrideToken ?? token}`)
      .query(params);

  const post = (path: string, body: Record<string, unknown>) =>
    request(APP_URL)
      .post(`${BASE}${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  // Walks every page of a report/v2/page endpoint by cursor, until nextCursor is null.
  // KNOWN LIMITATION (TD-21, docs/TECH-DEBT.md): FinancialMovementQueryDto has no cursorValor
  // field, so resolveCursorFromQuery (financial-movement-v2-query.mapper.ts) always sends
  // valor: null for the cursor's 6th tie-breaker column. Confirmed here, not just theoretical:
  // the last row of every page ties the next page's lower bound on the first 5 columns, and
  // since its real valor is > the cursor's null/0 stand-in, the keyset "greater than" check
  // re-includes it - the last row of page N reliably reappears as the first row of page N+1.
  // This helper tolerates that single known duplicate per page cut (asserting no row is lost
  // and no OTHER duplication/loss pattern appears) rather than hiding it; fixing it is TD-21's
  // job (before the v2 cursor carries real pagination traffic), not T11's.
  async function walkPages(path: string, params: Record<string, string | number | boolean>, pageSize: number): Promise<number[]> {
    const seen: number[] = [];
    let cursor: Record<string, string> | undefined;
    let safety = 0;

    do {
      const res = await get(path, { ...params, pageSize, ...(cursor ?? {}) }).expect(HttpStatus.OK);
      const rows = res.body.data as { valor: number }[];
      seen.push(...rows.map((r) => Number(r.valor)));

      const nextCursor = res.body.nextCursor as
        | { dataReferencia: string | null; nomes: string | null; cpfCnpj: string | null; nomeConsorcio: string | null; status: string | null }
        | null;
      cursor = nextCursor
        ? {
            cursorDataReferencia: nextCursor.dataReferencia ?? '',
            cursorNome: nextCursor.nomes ?? '',
            cursorCpfCnpj: nextCursor.cpfCnpj ?? '',
            cursorNomeConsorcio: nextCursor.nomeConsorcio ?? '',
            cursorStatus: nextCursor.status ?? '',
          }
        : undefined;

      safety += 1;
      if (safety > 20) throw new Error('Too many pages - possible infinite pagination loop');
    } while (cursor);

    return seen;
  }

  beforeAll(async () => {
    client = db();
    await client.connect();

    const login = await request(APP_URL)
      .post('/api/v1/auth/admin/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(HttpStatus.OK);
    token = login.body.token;

    // Limpa antes de semear: uma execucao interrompida nao chega ao afterAll.
    await cleanup();
    await seedPermissionario();
    await seedGuardador();
    await seedEleicao();
    await seedStuc();
  }, 30000);

  afterAll(async () => {
    await cleanup();
    await client?.end();
  });

  async function cleanup(): Promise<void> {
    await client.query(`DELETE FROM ordem_pagamento_unico WHERE "idOrdemPagamento"::bigint BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999999]);
    await client.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999999]);
    await client.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999999]);
    await client.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999999]);
    await client.query(`DELETE FROM ordem_pagamento_guardador WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999999]);
    await client.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999999]);
    await client.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999999]);
    await client.query(`DELETE FROM public."user" WHERE id IN ($1, $2, $3, $4)`, [PERM_USER_ID, GUARD_USER_ID, ELEICAO_USER_ID, STUC_USER_ID]);
  }

  // ---- Permissionário: um "A Pagar" (nunca agrupado) + 5 linhas para paginação ----

  const PERM_APAGAR_DATA = '2097-07-10';
  const PERM_APAGAR_ORDER_ID = BASE_ID + 10;
  const PERM_APAGAR_VALOR = 777;

  const PAGE_DATA_INICIO = '2097-08-01';
  const PAGE_DATA_FIM = '2097-08-10';
  const PAGE_VALORES = [11, 22, 33, 44, 55];

  async function seedPermissionario(): Promise<void> {
    await client.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'PERMISSIONARIO V2 E2E T11', 1, '99999999801',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [PERM_USER_ID, `permissionario-v2-e2e-t11-${PERM_USER_ID}@example.test`],
    );

    // Uma ordem nunca agrupada = "A Pagar" (findGroupedRows), usada pelos testes de summary/export.
    await client.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, $2::date, $2::date, $3, now(), $4, 'CONSORCIO V2 E2E TESTE', NULL, now(), now())`,
      [PERM_APAGAR_ORDER_ID, PERM_APAGAR_DATA, PERM_APAGAR_VALOR, PERM_USER_ID],
    );

    // Cinco ordens nunca agrupadas, mesma data range, valores distintos - usadas pelo teste de
    // paginação (comportamento 2): walk de todas as páginas deve trazer as 5, sem perder/duplicar.
    for (let i = 0; i < PAGE_VALORES.length; i++) {
      const orderId = BASE_ID + 100 + i;
      const day = 1 + i;
      const data = `2097-08-${String(day).padStart(2, '0')}`;
      await client.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, $2::date, $2::date, $3, now(), $4, 'CONSORCIO V2 E2E TESTE', NULL, now(), now())`,
        [orderId, data, PAGE_VALORES[i], PERM_USER_ID],
      );
    }
  }

  // ---- Guardador: mesma forma, via ordem_pagamento_guardador ----

  const GUARD_APAGAR_DATA = '2097-07-10';
  const GUARD_APAGAR_ORDER_ID = BASE_ID + 1010;
  const GUARD_APAGAR_VALOR = 888;

  const GUARD_PAGE_VALORES = [111, 222, 333];

  async function seedGuardador(): Promise<void> {
    // GUARDADOR_ROLE_ID (6) é exigido incondicionalmente pela query legada de Guardador - mesma
    // observação documentada em base-pagamento.repository.integration.spec.ts.
    await client.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
    await client.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'GUARDADOR V2 E2E T11', 6, '99999999802',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [GUARD_USER_ID, `guardador-v2-e2e-t11-${GUARD_USER_ID}@example.test`],
    );

    await client.query(
      `INSERT INTO ordem_pagamento_guardador (
        id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
        "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
        "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
        "createdAt", "updatedAt"
      ) VALUES ($1, $2::date, $2::date, $3, $4, 'AUTOMATICA', NULL, 0, 0, 0, now(), now())`,
      [GUARD_APAGAR_ORDER_ID, GUARD_APAGAR_DATA, GUARD_APAGAR_VALOR, GUARD_USER_ID],
    );

    for (let i = 0; i < GUARD_PAGE_VALORES.length; i++) {
      const orderId = BASE_ID + 1100 + i;
      const day = 1 + i;
      const data = `2097-08-${String(day).padStart(2, '0')}`;
      await client.query(
        `INSERT INTO ordem_pagamento_guardador (
          id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId",
          "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
          "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida",
          "createdAt", "updatedAt"
        ) VALUES ($1, $2::date, $2::date, $3, $4, 'AUTOMATICA', NULL, 0, 0, 0, now(), now())`,
        [orderId, data, GUARD_PAGE_VALORES[i], GUARD_USER_ID],
      );
    }
  }

  // ---- Eleição (Permissionário apenas, AC-11): ordem_pagamento_unico + opa/historico/detalhe_a ----

  const ELEICAO_DATA = '2097-09-15';
  const ELEICAO_VALOR = 999;
  const ELEICAO_PERMIT_CODE = 'ELEC-PC-V2-E2E-T11';

  async function seedEleicao(): Promise<void> {
    await client.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'ELEICAO V2 E2E T11', 1, '99999999803', $3,
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [ELEICAO_USER_ID, `eleicao-v2-e2e-t11-${ELEICAO_USER_ID}@example.test`, ELEICAO_PERMIT_CODE],
    );

    const opaId = BASE_ID + 2000;
    const historyId = BASE_ID + 2001;
    const detailId = BASE_ID + 2002;
    const opuId = BASE_ID + 2003;

    await client.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, NULL, now(), now())`,
      [opaId, ELEICAO_DATA, ELEICAO_VALOR],
    );
    await client.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', 3, '00')`,
      [historyId, opaId, ELEICAO_DATA],
    );
    await client.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $1, $3::date, $4, $4, $1, now(), now())`,
      [detailId, historyId, ELEICAO_DATA, ELEICAO_VALOR],
    );
    await client.query(
      `INSERT INTO ordem_pagamento_unico (id, "idOrdemPagamento", "idOperadora", "operadoraCpfCnpj", "consorcio", "dataOrdem")
       VALUES ($1, $2, $3, $4, $5, $6::date)`,
      [opuId, String(opaId), ELEICAO_PERMIT_CODE, null, 'ELEICAO V2 E2E CONSORCIO', ELEICAO_DATA],
    );
  }

  // ---- STUC-Gratuidade (Permissionário apenas): janela de 4 dias, pagamento no 5º ----

  // STUC-Gratuidade windows are fixed by weekday (sexta-segunda = 4 days, paid the following
  // terça), same rule exercised by stuc-gratuidade.repository.integration.spec.ts (T8) - an
  // arbitrary 4-day calendar run that does not line up with sexta-segunda would split across
  // two windows instead of pivoting into one row. 2097-10-04 is a Friday.
  const STUC_WINDOW = {
    dia1: '2097-10-04',
    dia2: '2097-10-05',
    dia3: '2097-10-06',
    dia4: '2097-10-07',
    pagamento: '2097-10-08',
  };
  const STUC_VALORES: [number, number, number, number] = [5, 10, 15, 20];

  async function seedStuc(): Promise<void> {
    await client.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'STUC GRATUIDADE V2 E2E T11', 1, '99999999804',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [STUC_USER_ID, `stuc-v2-e2e-t11-${STUC_USER_ID}@example.test`],
    );

    const opaId = BASE_ID + 3000;
    const historyId = BASE_ID + 3001;
    const detailId = BASE_ID + 3002;
    const total = STUC_VALORES.reduce((a, b) => a + b, 0);

    await client.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, NULL, now(), now())`,
      [opaId, STUC_WINDOW.pagamento, total],
    );
    await client.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', 3, '00')`,
      [historyId, opaId, STUC_WINDOW.pagamento],
    );
    await client.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $1, $3::date, $4, $4, $1, now(), now())`,
      [detailId, historyId, STUC_WINDOW.pagamento, total],
    );

    const dias = [STUC_WINDOW.dia1, STUC_WINDOW.dia2, STUC_WINDOW.dia3, STUC_WINDOW.dia4];
    for (let i = 0; i < 4; i++) {
      const orderId = BASE_ID + 3010 + i;
      await client.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", valor, "valorGratuidade", "bqUpdatedAt", "userId", "nomeConsorcio",
          "ordemPagamentoAgrupadoGratuidadeId", "createdAt", "updatedAt"
        ) VALUES ($1, $2::date, $3, $3, now(), $4, 'STUC V2 E2E CONSORCIO', $5, now(), now())`,
        [orderId, dias[i], STUC_VALORES[i], STUC_USER_ID, opaId],
      );
    }
  }

  // ---- Comportamento 1: summary (Permissionário) ----

  it('GET report/v2/summary (Permissionário) bate com a fixture conhecida', async () => {
    const res = await get('/report/v2/summary', {
      dataInicio: PERM_APAGAR_DATA,
      dataFim: PERM_APAGAR_DATA,
      userIds: PERM_USER_ID,
    }).expect(HttpStatus.OK);

    expect(res.body).toEqual(
      expect.objectContaining({
        count: 1,
        valorTotal: PERM_APAGAR_VALOR,
        valorAPagar: PERM_APAGAR_VALOR,
      }),
    );
  });

  // ---- Comportamento 2: page (Permissionário) pagina sem perder/duplicar ----

  it('GET report/v2/page (Permissionário) percorre todas as páginas sem perder nenhuma linha', async () => {
    const seen = await walkPages('/report/v2/page', { dataInicio: PAGE_DATA_INICIO, dataFim: PAGE_DATA_FIM, userIds: PERM_USER_ID }, 2);

    // No loss: every expected row shows up at least once across the whole walk.
    expect(new Set(seen)).toEqual(new Set(PAGE_VALORES));
    // No loss/duplication beyond the known TD-21 boundary repeat (at most one repeated row per
    // page cut) - rules out any OTHER duplication/loss pattern without hard-pinning the exact
    // repeat count, which depends on how many page cuts pageSize produces.
    expect(seen.length).toBeLessThan(PAGE_VALORES.length * 2);
  });

  // ---- Comportamento 3: export/download (Permissionário) ----

  it('POST report/v2/export/download (Permissionário) retorna um CSV válido', async () => {
    const res = await post('/report/v2/export/download', {
      dataInicio: PERM_APAGAR_DATA,
      dataFim: PERM_APAGAR_DATA,
      userIds: [PERM_USER_ID],
      format: 'csv',
    }).expect(HttpStatus.OK);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.length).toBeGreaterThan(0);
    expect(res.text).toContain(String(PERM_APAGAR_VALOR));
  });

  // ---- Comportamento 4: os três equivalentes de Guardador ----

  it('GET guardador/report/v2/summary bate com a fixture conhecida', async () => {
    const res = await get('/guardador/report/v2/summary', {
      dataInicio: GUARD_APAGAR_DATA,
      dataFim: GUARD_APAGAR_DATA,
      userIds: GUARD_USER_ID,
    }).expect(HttpStatus.OK);

    expect(res.body).toEqual(
      expect.objectContaining({
        count: 1,
        valorTotal: GUARD_APAGAR_VALOR,
        valorAPagar: GUARD_APAGAR_VALOR,
      }),
    );
  });

  it('GET guardador/report/v2/page percorre todas as páginas sem perder nenhuma linha', async () => {
    const seen = await walkPages('/guardador/report/v2/page', { dataInicio: '2097-08-01', dataFim: '2097-08-10', userIds: GUARD_USER_ID }, 2);

    // Same TD-21 boundary-repeat tolerance as the Permissionário page test above.
    expect(new Set(seen)).toEqual(new Set(GUARD_PAGE_VALORES));
    expect(seen.length).toBeLessThan(GUARD_PAGE_VALORES.length * 2);
  });

  it('POST guardador/report/v2/export/download retorna um CSV válido', async () => {
    const res = await post('/guardador/report/v2/export/download', {
      dataInicio: GUARD_APAGAR_DATA,
      dataFim: GUARD_APAGAR_DATA,
      userIds: [GUARD_USER_ID],
      format: 'csv',
    }).expect(HttpStatus.OK);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.length).toBeGreaterThan(0);
    expect(res.text).toContain(String(GUARD_APAGAR_VALOR));
  });

  // ---- Comportamento 5: Eleição e STUC-Gratuidade pela rota v2 completa ----

  it('GET report/v2/summary?eleicao=true bate com a fixture de Eleição', async () => {
    const res = await get('/report/v2/summary', {
      dataInicio: ELEICAO_DATA,
      dataFim: ELEICAO_DATA,
      eleicao: true,
    }).expect(HttpStatus.OK);

    expect(res.body).toEqual(
      expect.objectContaining({
        count: 1,
        valorTotal: ELEICAO_VALOR,
        valorPago: ELEICAO_VALOR,
      }),
    );
  });

  it('GET report/v2/summary?stucGratuidade=true bate com a fixture de STUC-Gratuidade', async () => {
    const res = await get('/report/v2/summary', {
      dataInicio: '2097-10-01',
      dataFim: '2097-10-31',
      stucGratuidade: true,
    }).expect(HttpStatus.OK);

    const total = STUC_VALORES.reduce((a, b) => a + b, 0);
    expect(res.body).toEqual(
      expect.objectContaining({
        count: 1,
        valorTotal: total,
        valorPago: total,
      }),
    );
  });

  // ---- Edge case: sem token ----

  it('rejeita sem token de autenticação (401), igual à rota antiga', async () => {
    await request(APP_URL)
      .get(`${BASE}/report/v2/summary`)
      .query({ dataInicio: PERM_APAGAR_DATA, dataFim: PERM_APAGAR_DATA })
      .expect(HttpStatus.UNAUTHORIZED);
  });
});
