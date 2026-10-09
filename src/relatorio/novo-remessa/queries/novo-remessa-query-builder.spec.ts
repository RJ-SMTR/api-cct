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
});
