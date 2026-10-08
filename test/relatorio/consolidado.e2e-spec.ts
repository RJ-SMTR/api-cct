import { HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { Client } from 'pg';
import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';

/**
 * Relatório consolidado (Permissionário e Guardador).
 *
 * Cobre:
 * - filtros obrigatórios (dataInicio/dataFim) e a validação de ordem das datas;
 * - que o valor agregado por favorecido (Guardador) bate com uma consulta SQL independente,
 *   incluindo Pendência Paga em data única (por dataPagamento) e em intervalo (por dataVencimento);
 * - no Permissionário, sem consórcio/favorecido/"todos" selecionado, /consolidado assume
 *   "todos" como padrão em vez de devolver sempre vazio (ver nota na suíte correspondente).
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

const sumValor = (rows: { valor: string | number }[]) =>
  Math.round(rows.reduce((acc, r) => acc + Number(r.valor), 0) * 100) / 100;

// Mesmo critério do relatório consolidado de guardadores: agrupado por favorecido, somando
// o valor do segmento A, restrito a quem é guardador (roleId 6, como em buildConsorcioFilter
// quando nenhum consórcio é informado), sem ordens agrupadas que têm filhas e sem motivos AM/AE.
// O status é o mesmo CASE usado pela API (GUARDADOR_STATUS_CASE em guardador-novo-remessa-query-builder.ts).
//
// O SELECT DISTINCT na camada mais interna é necessário: um "opa" (ordem agrupada) pode reunir
// várias ordens individuais do guardador (ordem_pagamento_guardador) de dias diferentes num único
// pagamento. Sem o DISTINCT, o JOIN com ordem_pagamento_guardador multiplica a linha de
// detalhe_a/valorLancamento uma vez por ordem individual do grupo, somando o mesmo valor várias
// vezes — é isso que buildGuardadorBaseQuery (SELECT DISTINCT opa.id, nomes, valor, ...) evita.
const SQL_GUARDADOR_CONSOLIDADO_STATUS = `
  SELECT nomes, SUM(valor) AS valor
  FROM (
    SELECT DISTINCT opa.id, pu."fullName" AS nomes, da."valorLancamento" AS valor
    FROM ordem_pagamento_guardador opg
    INNER JOIN ordem_pagamento_agrupado opa ON opg."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN public."user" pu ON pu.id = opg."userId"
    WHERE da."dataVencimento" BETWEEN $1::date AND $2::date
      AND pu."roleId" = 6
      AND opa.id NOT IN (SELECT filha."ordemPagamentoAgrupadoId" FROM ordem_pagamento_agrupado filha WHERE filha."ordemPagamentoAgrupadoId" IS NOT NULL)
      AND (oph."motivoStatusRemessa" NOT IN ('AM','AE') OR oph."motivoStatusRemessa" IS NULL)
      AND (
        CASE
          WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
          WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
          WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
          WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
          WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
          ELSE 'Rejeitado'
        END
      ) = $3
  ) base
  GROUP BY nomes
`;

// Pendência Paga tem sua própria sub-consulta (buildGuardadorPendenciaPagaSingleDateQuery),
// filtrando pela data de pagamento da ordem (ou da ordem pai, se a OPA foi reagrupada em uma
// família de pendência), não pela dataVencimento usada pelos outros status. Usada quando
// dataInicio == dataFim (ver isSingleDate / includePendenciaPagaSingleDate no repositório);
// fora de uma data única ela cai na mesma consulta base de SQL_GUARDADOR_CONSOLIDADO_STATUS,
// filtrada por dataVencimento.
const SQL_GUARDADOR_PENDENCIA_PAGA_DATA_PAGAMENTO = `
  SELECT nomes, SUM(valor) AS valor
  FROM (
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
  ) base
  GROUP BY nomes
`;

describe('Relatório consolidado (e2e)', () => {
  let token: string;
  let client: Client;

  const get = (path: string, params: Record<string, string | number | boolean>) =>
    request(APP_URL)
      .get(`${BASE}${path}`)
      .set('Authorization', `Bearer ${token}`)
      .query(params);

  const sqlRows = async (sql: string, params: (string | number)[]) =>
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

  describe('Filtros obrigatórios', () => {
    const rotas = [
      { nome: 'Permissionário', path: '/consolidado' },
      { nome: 'Guardador', path: '/guardador/consolidado' },
    ];

    for (const rota of rotas) {
      it(`${rota.nome} / sem dataInicio retorna 400`, async () => {
        await get(rota.path, { dataFim: '2026-10-06' }).expect(HttpStatus.BAD_REQUEST);
      });

      it(`${rota.nome} / sem dataFim retorna 400`, async () => {
        await get(rota.path, { dataInicio: '2026-10-01' }).expect(HttpStatus.BAD_REQUEST);
      });

      it(`${rota.nome} / sem nenhuma data retorna 400`, async () => {
        await get(rota.path, {}).expect(HttpStatus.BAD_REQUEST);
      });

      it(`${rota.nome} / dataFim anterior a dataInicio retorna 400`, async () => {
        await get(rota.path, { dataInicio: '2026-10-06', dataFim: '2026-10-01' }).expect(HttpStatus.BAD_REQUEST);
      });
    }
  });

  describe('Guardador: valor consolidado bate com o SQL', () => {
    it('status Pago / 01/09 a 10/10/2026 bate com o SQL', async () => {
      const res = await get('/guardador/consolidado', {
        dataInicio: '2026-09-01',
        dataFim: '2026-10-10',
        pago: true,
      }).expect(HttpStatus.OK);

      const expected = await sqlRows(SQL_GUARDADOR_CONSOLIDADO_STATUS, ['2026-09-01', '2026-10-10', 'Pago']);
      expect(sumValor(res.body.data)).toBe(sumValor(expected));
      expect(res.body.data.length).toBe(expected.length);
    });

    it('status Pendência Paga / data única 23/09/2026 bate com o SQL (por dataPagamento)', async () => {
      const res = await get('/guardador/consolidado', {
        dataInicio: '2026-09-23',
        dataFim: '2026-09-23',
        pendenciaPaga: true,
      }).expect(HttpStatus.OK);

      const expected = await sqlRows(SQL_GUARDADOR_PENDENCIA_PAGA_DATA_PAGAMENTO, ['2026-09-23', '2026-09-23']);
      expect(sumValor(res.body.data)).toBe(sumValor(expected));
      expect(res.body.data.length).toBe(expected.length);
    });

    it('status Pendência Paga / intervalo 01/09 a 10/10/2026 bate com o SQL (por dataVencimento)', async () => {
      const res = await get('/guardador/consolidado', {
        dataInicio: '2026-09-01',
        dataFim: '2026-10-10',
        pendenciaPaga: true,
      }).expect(HttpStatus.OK);

      const expected = await sqlRows(SQL_GUARDADOR_CONSOLIDADO_STATUS, [
        '2026-09-01',
        '2026-10-10',
        'Pendencia Paga',
      ]);
      expect(sumValor(res.body.data)).toBe(sumValor(expected));
      expect(res.body.data.length).toBe(expected.length);
    });
  });

  describe('Permissionário: sem seletor de consórcio/favorecido, assume "todos"', () => {
    // findConsolidado só empilhava alguma sub-consulta em "queries" dentro de
    // "if (temFiltroConsorcio)" / "if (temFiltroVanzeiros)", e essas duas flags só ficavam
    // verdadeiras quando a requisição informava consorcioNome, todosConsorcios, userIds ou
    // todosVanzeiros. Sem nenhum desses, o método sempre devolvia {data: [], count: 0}, mesmo com
    // data válida, status válido e dados reais no banco — e a tela de Relatório Consolidado
    // (Permissionário) não envia nenhum desses por padrão. O fix assume todosConsorcios e
    // todosVanzeiros quando nenhum seletor é informado, em vez de retornar sempre vazio.
    it(
      'sem consórcio, favorecido ou "todos" selecionado equivale a todosConsorcios=true + todosVanzeiros=true',
      async () => {
        const dataInicio = '2026-09-01';
        const dataFim = '2026-10-10';

        const semSeletor = await get('/consolidado', { dataInicio, dataFim, pago: true }).expect(HttpStatus.OK);
        const comTodos = await get('/consolidado', {
          dataInicio,
          dataFim,
          pago: true,
          todosConsorcios: true,
          todosVanzeiros: true,
        }).expect(HttpStatus.OK);

        expect(semSeletor.body.count).toBeGreaterThan(0);
        expect(sumValor(semSeletor.body.data)).toBe(sumValor(comTodos.body.data));
      },
      60000,
    );

    it(
      'com um consórcio específico, o resultado difere do padrão "todos"',
      async () => {
        const dataInicio = '2026-09-01';
        const dataFim = '2026-10-10';

        const semSeletor = await get('/consolidado', { dataInicio, dataFim, pago: true }).expect(HttpStatus.OK);
        const umConsorcio = await get('/consolidado', {
          dataInicio,
          dataFim,
          pago: true,
          consorcioNome: 'STPC',
        }).expect(HttpStatus.OK);

        expect(umConsorcio.body.count).toBeGreaterThan(0);
        expect(umConsorcio.body.count).toBeLessThan(semSeletor.body.count);
      },
      30000,
    );
  });

  describe('Permissionário: filtros isolados que não levam consórcio/favorecido explícito', () => {
    // O fallback "assume todos" (ver suíte acima) faz temFiltroVanzeiros/temFiltroConsorcio
    // ficarem true mesmo sem seletor explícito. Algumas sub-queries só recebem um SELECT base
    // quando um subconjunto específico de flags de status está marcado; fora desse subconjunto
    // elas ficam como string vazia, mas o bloco de todosConsorcios/todosVanzeiros ainda concatena
    // um "AND ..." nelas e o resultado (um fragmento SQL solto) acaba entrando no UNION ALL.
    it('aPagar=true sozinho não quebra com erro de sintaxe SQL', async () => {
      await get('/consolidado', { dataInicio: '2026-09-01', dataFim: '2026-10-10', aPagar: true }).expect(HttpStatus.OK);
    }, 30000);

    it('eleicao=true sozinho não quebra com erro de sintaxe SQL', async () => {
      await get('/consolidado', { dataInicio: '2026-09-01', dataFim: '2026-10-10', eleicao: true }).expect(HttpStatus.OK);
    }, 30000);

    it('eleicao=true combinado com todosConsorcios=true não quebra por coluna inexistente', async () => {
      await get('/consolidado', {
        dataInicio: '2026-09-01',
        dataFim: '2026-10-10',
        eleicao: true,
        todosConsorcios: true,
      }).expect(HttpStatus.OK);
    }, 30000);
  });
});
