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

  // ADR 0012/pivotStucGratuidadeRows precisa do dia real de cada ordem para separar os dias
  // de uma janela de pagamento em colunas distintas. Usar a data de pagamento da tentativa
  // (igual para todos os dias da janela) colapsava os dias em uma única coluna/linha.
  it('stucGratuidade pendenciaPagamentoSingleDate query uses dataVencimento (not dataPagamento) as dataReferencia', () => {
    const sql = buildStucGratuidadePendenciaPagamentoSingleDateQuery({
      ...params,
      parentErrorStatuses: ['Rejeitado'],
    });

    expect(sql).toContain('da."dataVencimento" AS "dataReferencia"');
    expect(sql).not.toContain('op_pai."dataPagamento" AS "dataReferencia"');
    expect(sql).not.toContain('opa."dataPagamento" AS "dataReferencia"');
    // A data de pagamento continua disponível na própria coluna "dataPagamento".
    expect(sql).toContain('opa."dataPagamento" AS "dataPagamento"');
  });

  it('pendenciaPagamentoSingleDate (normal) keeps dataPagamento as dataReferencia', () => {
    const sql = buildPendenciaPagamentoSingleDateQuery({
      ...params,
      parentErrorStatuses: ['Rejeitado'],
    });

    expect(sql).toContain('op_pai."dataPagamento" AS "dataReferencia"');
    expect(sql).toContain('opa."dataPagamento" AS "dataReferencia"');
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

  // Achado testando contra produção (19/10/2026): 1326 linhas com statusRemessa IN (0,1) -
  // "A Pagar" no STATUS_CASE normal - caíam no ELSE 'Rejeitado' do ELEICAO_STATUS_CASE, que não
  // tinha essa faixa. Filtrar Eleição + "A Pagar"/"Pendencia Paga"/"Pendentes" também acionava o
  // fallback de ELEICAO_STATUS_FILTER (nenhum dos status reconhecidos selecionado) e devolvia
  // todas as linhas de Eleição sem filtrar por status nenhum.
  it('eleicao query classifies statusRemessa 0/1 as "A Pagar", not the Rejeitado fallback', () => {
    const sql = buildEleicaoQuery(params);

    expect(sql).toContain(`WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'`);
  });

  it('eleicao status filter recognizes "A Pagar" and does not fall back to "bring every row"', () => {
    const sql = buildEleicaoQuery(params);

    expect(sql).toContain(`'A Pagar' = ANY($4)`);
  });

  // op.dataOrdem is a plain `date` column (no time component): it never had this bug and
  // must not get the cast.
  it('pendentes query keeps filtering dataOrdem without a date cast', () => {
    const sql = buildPendentesQuery({});

    expect(sql).toContain('op."dataOrdem" BETWEEN $1 AND $2');
  });
});

describe('novo-remessa-query-builder sem DISTINCT (ADR 0007 / TD-14)', () => {
  const params = { consorcioFilterParamIndex: 5 };

  // The select list has no op.id, only opa.id (the grouping), so a plain SELECT DISTINCT
  // is the wrong tool either way: for AGRUPAMENTO_GRATUIDADE (op.valorGratuidade, genuinely
  // per order) it wrongly collapsed two distinct orders that coincided in value (ADR 0007).
  // For AGRUPAMENTO_NORMAL it is replaced below by an explicit "one order per agrupamento"
  // restriction (ADR 0011) instead of DISTINCT, since da.valorLancamento is the batch's total,
  // not a per-order value - DISTINCT alone can't tell "two real distinct lançamentos that
  // coincide in value" apart from "N child orders of the very same lançamento".
  it.each([
    ['base', buildBaseQuery(params)],
    ['stucGratuidade', buildStucGratuidadeQuery(params)],
    ['pendenciaPagaSingleDate', buildPendenciaPagaSingleDateQuery(params)],
    ['pendenciaPagamentoSingleDate', buildPendenciaPagamentoSingleDateQuery(params)],
  ])('%s query does not deduplicate rows via SELECT DISTINCT', (_name, sql) => {
    expect(sql).not.toMatch(/SELECT\s+DISTINCT/i);
  });
});

describe('novo-remessa-query-builder uma ordem por agrupamento (ADR 0011, corrige o ADR 0010)', () => {
  const params = { consorcioFilterParamIndex: 5 };

  // AGRUPAMENTO_NORMAL: da."valorLancamento" is the whole batch's (OrdemPagamentoAgrupado)
  // total, repeated on every child ordem_pagamento row (fan-out by design, see CONTEXT.md).
  // Without restricting to one representative child order per agrupamento, the service's
  // SUM(valor) counts the same lançamento once per child order. Confirmed with real data
  // (2026-09-10, Permissionário, Pago): an agrupamento with 8 child orders had its R$5.548,80
  // lançamento summed 8x (ADR 0011). The ADR 0010 example (opa.id=253902) is the same bug,
  // misdiagnosed as "3 distinct ordens of R$12,38" - it is 1 lançamento (da.id=21536) fanned
  // out across 3 child orders; the real total for that agrupamento is R$12,38, not R$37,14.
  it.each([
    ['base', buildBaseQuery(params)],
    ['pendenciaPagaSingleDate', buildPendenciaPagaSingleDateQuery(params)],
  ])('%s query (AGRUPAMENTO_NORMAL) restricts to one ordem_pagamento per agrupamento', (_name, sql) => {
    expect(sql).toContain('op.id = (');
    expect(sql).toContain('SELECT MIN(o.id)');
    expect(sql).toContain('o."ordemPagamentoAgrupadoId" = opa.id');
  });

  it('pendenciaPagamentoSingleDate query (AGRUPAMENTO_NORMAL) restricts to one ordem_pagamento per agrupamento in both UNION ALL branches', () => {
    const sql = buildPendenciaPagamentoSingleDateQuery(params);

    const matches = sql.match(/SELECT MIN\(o\.id\) FROM ordem_pagamento o WHERE o\."ordemPagamentoAgrupadoId" = opa\.id/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  // AGRUPAMENTO_GRATUIDADE: op."valorGratuidade" is genuinely per order (ADR 0007) - no
  // restriction should be added here, or STUC - Gratuidade would start dropping real money.
  it.each([
    ['stucGratuidade', buildStucGratuidadeQuery(params)],
    ['stucGratuidadePendenciaPagaSingleDate', buildStucGratuidadePendenciaPagaSingleDateQuery(params)],
    ['stucGratuidadePendenciaPagamentoSingleDate', buildStucGratuidadePendenciaPagamentoSingleDateQuery(params)],
  ])('%s query (AGRUPAMENTO_GRATUIDADE) is not restricted to one ordem_pagamento per agrupamento', (_name, sql) => {
    expect(sql).not.toContain('SELECT MIN(o.id)');
  });

  // Found testing against prod (real data, 2026-10-26): sibling ordens of the same lote share
  // one detalhe_a, so da."dataVencimento" is identical for every ordem in the window - the
  // pivot (resolveStucPaymentWindow/pivotStucGratuidadeRows, ADR 0012) needs each ordem's own
  // day to place it in the right dataOrdemPagamento1-4 column; with the lote's shared payment
  // date, every sibling collapses into the same column instead of spreading across the window.
  // AGRUPAMENTO_NORMAL doesn't pivot, so it keeps da."dataVencimento" (the lote's date).
  it.each([
    ['stucGratuidade', buildStucGratuidadeQuery(params)],
    ['stucGratuidadePendenciaPagaSingleDate', buildStucGratuidadePendenciaPagaSingleDateQuery(params)],
  ])('%s query (AGRUPAMENTO_GRATUIDADE) uses each ordem\'s own day as dataReferencia, not the lote\'s dataVencimento', (_name, sql) => {
    expect(sql).toContain('DATE(op."dataOrdem") AS "dataReferencia"');
    expect(sql).not.toContain('da."dataVencimento" AS "dataReferencia"');
  });

  it.each([
    ['base', buildBaseQuery(params)],
    ['pendenciaPagaSingleDate', buildPendenciaPagaSingleDateQuery(params)],
  ])('%s query (AGRUPAMENTO_NORMAL) keeps the lote\'s dataVencimento as dataReferencia', (_name, sql) => {
    expect(sql).toContain('da."dataVencimento" AS "dataReferencia"');
  });
});
