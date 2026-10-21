import {
  buildBaseQuery,
  buildEleicaoQuery,
  buildPendentesQuery,
  buildPendenciaPagamentoSingleDateQuery,
  buildPendenciaPagaSingleDateQuery,
  buildStucGratuidadeQuery,
  buildStucGratuidadePendenciaPagaSingleDateQuery,
  buildStucGratuidadePendenciaPagamentoSingleDateQuery,
} from './novo-remessa-query-builder';

describe('novo-remessa-query-builder codigoErro', () => {
  const params = { consorcioFilterParamIndex: 5 };

  // Every select of the UNION ALL must expose the same columns.
  it.each([
    ['base', buildBaseQuery(params)],
    ['eleicao', buildEleicaoQuery(params)],
    ['pendentes', buildPendentesQuery({})],
    ['pendenciaPagaSingleDate', buildPendenciaPagaSingleDateQuery(params)],
    ['stucGratuidade', buildStucGratuidadeQuery(params)],
  ])('%s query exposes the codigoErro column', (_name, sql) => {
    expect(sql).toContain('AS "codigoErro"');
  });

  it.each([
    ['base', buildBaseQuery(params)],
    ['eleicao', buildEleicaoQuery(params)],
  ])('%s query reads the occurrence code only for Estorno and Rejeitado', (_name, sql) => {
    expect(sql).toContain(`IN ('Estorno', 'Rejeitado')`);
    expect(sql).toContain('TRIM(oph."motivoStatusRemessa")');
  });

  it.each([
    ['pendentes', buildPendentesQuery({})],
    ['pendenciaPagaSingleDate', buildPendenciaPagaSingleDateQuery(params)],
  ])('%s query has no occurrence code', (_name, sql) => {
    expect(sql).toContain('NULL::text AS "codigoErro"');
  });

  it('stucGratuidade query filters by valorGratuidade and follows the gratuidade grouping', () => {
    const sql = buildStucGratuidadeQuery(params);

    expect(sql).toContain('op."valorGratuidade" IS NOT NULL');
    expect(sql).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
    expect(sql).not.toContain('op."ordemPagamentoAgrupadoId" = opa.id');
    expect(sql).toContain('op."valorGratuidade" AS valor');
    expect(sql).not.toContain('da."valorLancamento" AS valor');
  });

  it('stucGratuidade query keeps every status possible (not the eleicao-restricted set)', () => {
    const sql = buildStucGratuidadeQuery(params);

    expect(sql).toContain("'Pendencia Paga'");
    expect(sql).toContain("'Aguardando Pagamento'");
    expect(sql).toContain("'A Pagar'");
  });

  it('stucGratuidade pendenciaPagaSingleDate query follows the gratuidade grouping and filters by statusRemessa 5', () => {
    const sql = buildStucGratuidadePendenciaPagaSingleDateQuery(params);

    expect(sql).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
    expect(sql).not.toContain('op."ordemPagamentoAgrupadoId" = opa.id');
    expect(sql).toContain('op."valorGratuidade" AS valor');
    expect(sql).toContain('oph."statusRemessa" = 5');
  });

  it('stucGratuidade pendenciaPagamentoSingleDate query follows the gratuidade grouping through the parent attempt', () => {
    const sql = buildStucGratuidadePendenciaPagamentoSingleDateQuery({
      ...params,
      parentErrorStatuses: ['Rejeitado'],
    });

    expect(sql).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
    expect(sql).not.toContain('op."ordemPagamentoAgrupadoId" = opa.id');
    expect(sql).toContain('op."valorGratuidade" AS valor');
    expect(sql).toContain('op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date');
    expect(sql).toContain("IN ('Rejeitado')");
  });

  it('selects a single-day rejected family through the parent attempt and latest history', () => {
    const sql = buildPendenciaPagamentoSingleDateQuery({
      ...params,
      parentErrorStatuses: ['Rejeitado'],
    });

    expect(sql).toContain('op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date');
    expect(sql).toContain('MAX(oph_mais_recente.id)');
    expect(sql).toContain('oph_pai."motivoStatusRemessa"');
    expect(sql).toContain("IN ('Rejeitado')");
    expect(sql).toContain('da."valorLancamento" AS valor');
  });

  // Estorno/Rejeitado without a parent (never had a retry/correction attempt) were silently
  // dropped from the single-day filter: the family branch above requires opa."ordemPagamentoAgrupadoId"
  // via INNER JOIN, so a first-level order with no family history never matched it. Confirmed in
  // production for 2026-10-20: 3 "Estorno" rows (R$ 4.560,00) invisible to the single-day filter,
  // yet present in the multi-day view (buildBaseQuery, which has no such requirement).
  it('also selects a single-day rejected/estornado order that has no parent (no retry history)', () => {
    const sql = buildPendenciaPagamentoSingleDateQuery({
      ...params,
      parentErrorStatuses: ['Estorno'],
    });

    expect(sql).toMatch(/UNION ALL/);
    expect(sql).toContain('opa."ordemPagamentoAgrupadoId" IS NULL');
    expect(sql).toContain('opa."dataPagamento"::date BETWEEN $1::date AND $2::date');
  });
});

describe('novo-remessa-query-builder período (dataVencimento)', () => {
  const params = { consorcioFilterParamIndex: 5 };

  // dataVencimento is a `timestamp without time zone` column written at 03:00:00 (midnight
  // in Brasília). A plain BETWEEN $1 AND $2 compares it against the implicit
  // 'yyyy-MM-dd 00:00:00', silently excluding the last day of the period (ADR 0005).
  it.each([
    ['base', buildBaseQuery(params)],
    ['stucGratuidade', buildStucGratuidadeQuery(params)],
  ])('%s query casts the period filter to date', (_name, sql) => {
    expect(sql).toContain('da."dataVencimento"::date BETWEEN $1::date AND $2::date');
  });

  it('eleicao query casts the period filter to date', () => {
    const sql = buildEleicaoQuery(params);

    expect(sql).toContain('da."dataVencimento"::date BETWEEN $1::date AND $2::date');
  });

  // op.dataOrdem is a plain `date` column (no time component): it never had this bug and
  // must not get the cast.
  it('pendentes query keeps filtering dataOrdem without a date cast', () => {
    const sql = buildPendentesQuery({});

    expect(sql).toContain('op."dataOrdem" BETWEEN $1 AND $2');
  });
});

describe('novo-remessa-query-builder sem DISTINCT (ADR 0007)', () => {
  const params = { consorcioFilterParamIndex: 5 };

  // The select list has no op.id, only opa.id (the grouping). SELECT DISTINCT silently
  // collapsed two distinct ordens de pagamento of the same agrupamento whenever they
  // coincided in value, undercounting Consolidado and Movimentação Financeira totals.
  it.each([
    ['base', buildBaseQuery(params)],
    ['stucGratuidade', buildStucGratuidadeQuery(params)],
  ])('%s query does not deduplicate rows', (_name, sql) => {
    expect(sql).not.toMatch(/SELECT\s+DISTINCT/i);
  });
});
