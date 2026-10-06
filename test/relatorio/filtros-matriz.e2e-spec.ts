import { HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';

/**
 * Matriz de filtros do relatório de movimentação financeira.
 *
 * Para cada combinação (perfil x data x status x valor mínimo), verifica que:
 * - a API responde 200 (sem erro de consulta);
 * - quando a página vem completa (sem próxima página), a soma dos valores das linhas
 *   bate com o valorTotal do resumo da mesma combinação.
 *
 * Requer API em APP_URL apontando para um banco de teste (nunca o banco local).
 */

const BASE = '/api/v1/cnab/relatorio-novo-remessa';

const PERFIS = [
  { nome: 'Permissionário', pagina: '/report/page', resumo: '/report/summary' },
  { nome: 'Guardador', pagina: '/guardador/report/page', resumo: '/guardador/report/summary' },
];

const DATAS: Record<string, { dataInicio: string; dataFim: string } | null> = {
  'sem data': null,
  'data única 01/10/2026': { dataInicio: '2026-10-01', dataFim: '2026-10-01' },
  'data única 23/09/2026': { dataInicio: '2026-09-23', dataFim: '2026-09-23' },
  'intervalo 01/10 a 06/10': { dataInicio: '2026-10-01', dataFim: '2026-10-06' },
  'intervalo setembro/2026': { dataInicio: '2026-09-01', dataFim: '2026-09-30' },
};

// Flags de status vindas da tela (uma por vez, e o conjunto de todos).
const STATUS: Record<string, Record<string, boolean>> = {
  'sem status': {},
  Pago: { pago: true },
  'A pagar': { aPagar: true },
  'Aguardando pagamento': { emProcessamento: true },
  Erro: { erro: true },
  Estorno: { estorno: true },
  Rejeitado: { rejeitado: true },
  'Pendencia Paga': { pendenciaPaga: true },
  'Pendentes (OPs atrasadas)': { pendentes: true },
};

const VALOR_MIN: Record<string, number | null> = {
  'sem valor mínimo': null,
  'valor mínimo 100': 100,
};

const sumValor = (rows: { valor: string | number }[]) =>
  Math.round(rows.reduce((acc, r) => acc + Number(r.valor), 0) * 100) / 100;

type Combo = { perfil: (typeof PERFIS)[number]; data: string; status: string; valorMin: string };

const combos: Combo[] = [];
for (const perfil of PERFIS) {
  for (const data of Object.keys(DATAS)) {
    for (const status of Object.keys(STATUS)) {
      for (const valorMin of Object.keys(VALOR_MIN)) {
        combos.push({ perfil, data, status, valorMin });
      }
    }
  }
}

describe('Matriz de filtros do relatório de movimentação financeira (e2e)', () => {
  let token: string;

  beforeAll(async () => {
    const login = await request(APP_URL)
      .post('/api/v1/auth/admin/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(HttpStatus.OK);
    token = login.body.token;
  });

  const params = (c: Combo) => ({
    ...(DATAS[c.data] ?? {}),
    ...STATUS[c.status],
    ...(VALOR_MIN[c.valorMin] !== null ? { valorMin: VALOR_MIN[c.valorMin] } : {}),
  });

  test.each(combos.map((c) => [`${c.perfil.nome} | ${c.data} | ${c.status} | ${c.valorMin}`, c]))(
    '%s',
    async (_nome, c) => {
      const combo = c as Combo;
      const query = { ...params(combo), page: 1, pageSize: 9999 };

      const pagina = await request(APP_URL)
        .get(`${BASE}${combo.perfil.pagina}`)
        .set('Authorization', `Bearer ${token}`)
        .query(query);
      expect(pagina.status).toBe(HttpStatus.OK);

      const resumo = await request(APP_URL)
        .get(`${BASE}${combo.perfil.resumo}`)
        .set('Authorization', `Bearer ${token}`)
        .query(query);
      expect(resumo.status).toBe(HttpStatus.OK);

      const linhas = pagina.body.data ?? [];
      const paginaCompleta = pagina.body.nextCursor === null || pagina.body.nextCursor === undefined;
      if (paginaCompleta && resumo.body.valorTotal !== undefined) {
        expect(sumValor(linhas)).toBe(Math.round(Number(resumo.body.valorTotal) * 100) / 100);
      }
    },
    60000,
  );
});
