import {
  buildBaseQuery,
  buildEleicaoAPagarQuery,
  buildEleicaoQuery,
  buildPendentesQuery,
  buildPendenciaPagamentoSingleDateQuery,
  buildPendenciaPagaSingleDateQuery,
  buildPendenciaPagaPasso0Query,
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
  // tinha essa faixa.
  it('eleicao query classifies statusRemessa 0/1 as "A Pagar", not the Rejeitado fallback', () => {
    const sql = buildEleicaoQuery(params);

    expect(sql).toContain(`WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'`);
  });

  // ELEICAO_STATUS_FILTER tinha um fallback "OR NOT (nenhum dos 5 status de Eleição está em
  // $4)" para não zerar o resultado quando $4 trazia só status que não existem no vocabulário
  // de Eleição (ex.: "Pendentes"/"Pendencia Paga", selecionáveis junto com Eleição na tela -
  // ver reportFilterOptions.js). Esse fallback tinha o efeito contrário ao pretendido: em vez
  // de não filtrar por status nenhum, ele devolvia TODAS as linhas de Eleição sem filtrar -
  // inclusive "Pago", mesmo esse não estando selecionado (achado testando Eleição + "Pendencia
  // Paga": voltava "Pago" junto). O filtro correto é "sem status selecionado -> traz tudo;
  // com status selecionado que não bate com nenhuma linha -> não traz nada".
  it('eleicao status filter has no "bring every row" fallback for unmatched statuses', () => {
    const sql = buildEleicaoQuery(params);

    expect(sql).not.toMatch(/OR\s+NOT\s*\(/);
    expect(sql).toContain('$4::text[] IS NULL');
  });

  // "user"."cpfCnpj" não é único (achado contra stag, 19/10/2026: um favorecido tinha 2
  // cadastros ativos com o mesmo CPF, nenhum deletedAt/bloqueado). Ligar por cpfCnpj sem
  // nenhuma condição faria fan-out - a mesma ordem viraria 2 linhas, dobrando o valor dela no
  // total. permitCode/idOperadora (chave do operador, não o CPF dele) é a ligação principal.
  it('eleicao query joins "user" by permitCode/idOperadora as the primary match', () => {
    const sql = buildEleicaoQuery(params);

    expect(sql).toContain('WHERE u."permitCode" = opu."idOperadora"');
  });

  // ADR 0019: ordens antigas (ex. nov/2024) têm "idOperadora" NULL - o campo ainda não existia
  // preenchido na época -, então o join por permitCode não encontra ninguém e a ordem some do
  // relatório. Verificado contra o banco que essa população não tem CPF duplicado, então o
  // fallback por operadoraCpfCnpj, usado só quando não há usuário com aquele permitCode, não
  // reintroduz o fan-out que motivou a troca para permitCode.
  it('eleicao query falls back to operadoraCpfCnpj only when no user matches permitCode', () => {
    const sql = buildEleicaoQuery(params);

    expect(sql).toContain('AND u."cpfCnpj" = opu."operadoraCpfCnpj"');
    expect(sql).toContain('NOT EXISTS (\n        SELECT 1 FROM public."user" u2 WHERE u2."permitCode" = opu."idOperadora"\n      )');
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
    // A ordem representante (menor id) vem de uma LATERAL que para na primeira ordem do agrupamento.
    expect(sql).toMatch(/INNER JOIN LATERAL \(\s*SELECT o\.\* FROM ordem_pagamento o\s+WHERE o\."ordemPagamentoAgrupadoId" = opa\.id\s+ORDER BY o\.id\s+LIMIT 1\s*\) op ON true/);
    expect(sql).not.toContain('SELECT MIN(o.id)');
  });

  it('pendenciaPagamentoSingleDate query (AGRUPAMENTO_NORMAL) restricts to one ordem_pagamento per agrupamento in both UNION ALL branches', () => {
    const sql = buildPendenciaPagamentoSingleDateQuery(params);

    const matches = sql.match(/ORDER BY o\.id\s+LIMIT 1\s*\) op ON true/g) ?? [];
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

// "Favorecido = Todos" deve trazer só favorecidos pagos avulso/individualmente (modais
// STPC/STPL/TEC), nunca favorecido de consórcio comum (Internorte, Santa Cruz etc.), que só
// deveria aparecer agregado via o filtro de Consórcio (CONTEXT.md, achado 2026-11-04). O
// Consolidado (getQueryVanzeiros) já restringia assim; aqui ainda faltava - confirmado contra
// hml (~R$2,99M de diferença no mesmo filtro, Permissionário/Pago/01-09 a 01-10-2026).
describe('novo-remessa-query-builder todosVanzeiros restringe aos modais (STPC/STPL/TEC)', () => {
  const params = { consorcioFilterParamIndex: 5 };
  const MODAIS_FILTER_MARKER = `pu."permitCode" LIKE '4%' OR pu."permitCode" LIKE '81%' OR pu."permitCode" LIKE '7%'`;

  it.each([
    ['base', buildBaseQuery({ ...params, todosVanzeiros: true })],
    ['eleicao', buildEleicaoQuery({ ...params, todosVanzeiros: true })],
    ['pendenciaPagaSingleDate', buildPendenciaPagaSingleDateQuery({ ...params, todosVanzeiros: true })],
    ['pendenciaPagamentoSingleDate', buildPendenciaPagamentoSingleDateQuery({ ...params, todosVanzeiros: true })],
    ['pendenciaPagaPasso0', buildPendenciaPagaPasso0Query({ ...params, todosVanzeiros: true })],
    ['stucGratuidade', buildStucGratuidadeQuery({ ...params, todosVanzeiros: true })],
    ['stucGratuidadePendenciaPagaSingleDate', buildStucGratuidadePendenciaPagaSingleDateQuery({ ...params, todosVanzeiros: true })],
    ['stucGratuidadePendenciaPagamentoSingleDate', buildStucGratuidadePendenciaPagamentoSingleDateQuery({ ...params, todosVanzeiros: true })],
  ])('%s query restricts todosVanzeiros to STPC/STPL/TEC when marked explicitly', (_name, sql) => {
    expect(sql).toContain(MODAIS_FILTER_MARKER);
    expect(sql).toContain('cpfCnpj" NOT IN');
  });

  it.each([
    ['base', buildBaseQuery(params)],
    ['eleicao', buildEleicaoQuery(params)],
    ['pendenciaPagaSingleDate', buildPendenciaPagaSingleDateQuery(params)],
    ['pendenciaPagamentoSingleDate', buildPendenciaPagamentoSingleDateQuery(params)],
    ['pendenciaPagaPasso0', buildPendenciaPagaPasso0Query(params)],
    ['stucGratuidade', buildStucGratuidadeQuery(params)],
  ])('%s query does not restrict to modais when a specific favorecido is selected (todosVanzeiros not set)', (_name, sql) => {
    expect(sql).not.toContain(MODAIS_FILTER_MARKER);
    expect(sql).not.toContain('cpfCnpj" NOT IN');
  });

  it('pendenciaPagamentoSingleDate query restricts to modais in both UNION ALL branches', () => {
    const sql = buildPendenciaPagamentoSingleDateQuery({ ...params, todosVanzeiros: true });

    const matches = sql.match(/pu\."permitCode" LIKE '4%' OR pu\."permitCode" LIKE '81%' OR pu\."permitCode" LIKE '7%'/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  // VLT (permitCode='8') é pago por consórcio, não avulso - o filtro de "Todos" favorecidos
  // restringe só a STPC ('4%')/STPL ('81%')/TEC ('7%'), sem checar permitCode='8' (VLT).
  it('modais filter excludes VLT (permitCode=8), only STPC/STPL/TEC', () => {
    expect(MODAIS_FILTER_MARKER).not.toContain(`permitCode" = '8'`);
  });

  // buildPendentesQuery já restringia aos modais por um mecanismo diferente (default do bind
  // de consórcio para ARRAY['STPC','STPL','TEC'] quando nenhum é passado) - não precisa do
  // MODAIS_FILTER novo, e não lê todosVanzeiros/NOT_CPF_FILTER de forma alguma.
  it('pendentes query already restricts to modais by default (different mechanism), untouched by this fix', () => {
    const sql = buildPendentesQuery({ todosVanzeiros: true });

    expect(sql).toContain(`ARRAY['STPC','STPL','TEC']`);
    expect(sql).not.toContain(MODAIS_FILTER_MARKER);
  });
});

// hasConsorcioFilter: uma vez que o usuário selecionou um Consórcio (específico ou "Todos"),
// MODAIS_FILTER não deve restringir a STPC/STPL/TEC - quem decide quais linhas aparecem é o
// filtro de consórcio (consorcioParam/CONSORCIO_CASE), não o default de "Favorecido = Todos"
// sem Consórcio nenhum. Sem essa distinção, "Consórcio = Todos" (ou um consórcio comum
// específico, ex. Internorte) ficava sem VLT e sem os consórcios comuns na Movimentação
// Financeira, divergindo do total do Consolidado (achado 2026-11-04).
describe('novo-remessa-query-builder hasConsorcioFilter desliga o MODAIS_FILTER', () => {
  const params = { consorcioFilterParamIndex: 5, todosVanzeiros: true };
  const MODAIS_FILTER_MARKER = `pu."permitCode" LIKE '4%' OR pu."permitCode" LIKE '81%' OR pu."permitCode" LIKE '7%'`;

  it.each([
    ['base', buildBaseQuery({ ...params, hasConsorcioFilter: true })],
    ['eleicao', buildEleicaoQuery({ ...params, hasConsorcioFilter: true })],
    ['pendenciaPagaSingleDate', buildPendenciaPagaSingleDateQuery({ ...params, hasConsorcioFilter: true })],
    ['pendenciaPagamentoSingleDate', buildPendenciaPagamentoSingleDateQuery({ ...params, hasConsorcioFilter: true })],
    ['pendenciaPagaPasso0', buildPendenciaPagaPasso0Query({ ...params, hasConsorcioFilter: true })],
    ['stucGratuidade', buildStucGratuidadeQuery({ ...params, hasConsorcioFilter: true })],
    ['stucGratuidadePendenciaPagaSingleDate', buildStucGratuidadePendenciaPagaSingleDateQuery({ ...params, hasConsorcioFilter: true })],
    ['stucGratuidadePendenciaPagamentoSingleDate', buildStucGratuidadePendenciaPagamentoSingleDateQuery({ ...params, hasConsorcioFilter: true })],
  ])('%s query does not restrict to modais when a consórcio filter is active, even with todosVanzeiros', (_name, sql) => {
    expect(sql).not.toContain(MODAIS_FILTER_MARKER);
    // NOT_CPF_FILTER (exclusão dos CNPJs institucionais) também desliga com consórcio escolhido
    // (ADR 0018): o pagamento do consórcio é lançado no CNPJ institucional dele, excluí-lo fazia
    // a Movimentação Financeira mostrar R$ 0,00 para VLT/Internorte/Santa Cruz etc. mesmo com o
    // consórcio explicitamente selecionado, divergindo do Consolidado (achado 2026-11-06).
    expect(sql).not.toContain('cpfCnpj" NOT IN');
  });

  it('keeps restricting to modais when todosVanzeiros is set without any consórcio filter (hasConsorcioFilter not set)', () => {
    const sql = buildBaseQuery(params);
    expect(sql).toContain(MODAIS_FILTER_MARKER);
  });
});

// A checagem "agrupamento não é pai" tem que ser um NOT IN sem correlação: o NOT EXISTS correlacionado deixava o
// planner ler ordem_pagamento_agrupado inteira por linha (Movimentação Financeira: mais de 110 s para 2 dias, contra
// 3 s com o NOT IN, mesmo resultado). Sem o IS NOT NULL no subselect, um único NULL descartaria todas as linhas.
describe('novo-remessa-query-builder - agrupamento sem filhas', () => {
  const params = { consorcioFilterParamIndex: 5 };

  it.each([
    ['base', buildBaseQuery(params)],
    ['pendenciaPagaSingleDate', buildPendenciaPagaSingleDateQuery(params)],
    ['pendenciaPagaPasso0', buildPendenciaPagaPasso0Query(params)],
    ['pendenciaPagamentoSingleDate', buildPendenciaPagamentoSingleDateQuery(params)],
  ])('%s query usa NOT IN sem correlação e ignora NULL', (_name, sql) => {
    expect(sql).toContain('opa.id NOT IN (');
    expect(sql).toContain('WHERE filha."ordemPagamentoAgrupadoId" IS NOT NULL');
    expect(sql).not.toMatch(/ordem_pagamento_agrupado filha\s+WHERE filha\."ordemPagamentoAgrupadoId" = opa\.id/);
  });
});

describe('novo-remessa-query-builder Eleição: consórcio pelo permitCode, igual ao Consolidado', () => {
  const params = { consorcioFilterParamIndex: 5 };

  it.each([
    ['eleicao paga', buildEleicaoQuery(params)],
    ['eleicao a pagar', buildEleicaoAPagarQuery(params)],
  ])('%s filtra e mostra o consórcio pelo permitCode do favorecido', (_name, sql) => {
    // Rótulo pelo cadastro do favorecido; filtro pelo permitCode da própria ordem (idOperadora),
    // sem depender da busca de usuário (desempenho).
    expect(sql).toContain(`WHEN pu."permitCode" LIKE '4%' THEN 'STPC'`);
    expect(sql).toMatch(/UPPER\(TRIM\(\s*CASE\s*WHEN opu\."idOperadora" = '8'[\s\S]*ELSE opu\."consorcio"\s*END\s*\)\) = ANY\(\$5\)/);
    expect(sql).not.toContain('TRIM(UPPER(opu."consorcio"))');
    // Valor em numeric nos dois ramos: "valorTotalTransacaoLiquido" vem de uma tabela carregada de
    // fora e, misturada no UNION com o numeric do detalhe_a, levava a soma para ponto flutuante.
    expect(sql).toMatch(/ROUND\((da\."valorLancamento"|opu\."valorTotalTransacaoLiquido")::numeric, 2\) AS valor/);
    expect(sql).not.toMatch(/opu\."consorcio" AS "nomeConsorcio"/);
  });
});
