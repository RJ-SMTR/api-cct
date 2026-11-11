import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { buildCodigoErroSql } from './descricao-erro';

export type NovoRemessaBaseParams = {
  todosVanzeiros?: boolean;
  consorcioFilterParamIndex: number;
  parentErrorStatuses?: Array<'Estorno' | 'Rejeitado'>;
  /**
   * Um consórcio (ou "Todos os consórcios") explicitamente selecionado - distinto de
   * "nenhum consórcio selecionado" (ramo padrão, ver MODAIS_FILTER). Sem essa distinção,
   * MODAIS_FILTER (pensado só para "Favorecido = Todos" sem Consórcio nenhum) também
   * restringia a STPC/STPL/TEC uma busca por Consórcio = Todos (ou por um consórcio
   * específico não-modal, ex. Internorte) - a Movimentação Financeira ficava sem VLT e
   * sem os consórcios comuns, divergindo do total do Consolidado (achado 2026-11-04).
   */
  hasConsorcioFilter?: boolean;
  /**
   * "Desativados" (favorecido bloqueado). Só usado por buildPendenciaPagamentoTemplate: o UNION
   * ALL interno tem dois SELECTs, e o padrão do resto do arquivo (o service anexa
   * "AND pu.bloqueado = ..." ao final do SQL) só alcançaria o segundo - precisa ir no WHERE de
   * cada ramo (achado 2026-11-06, auditoria de bloqueado pós-ADR 0017).
   */
  desativados?: boolean;
};

export type NovoRemessaPendentesParams = {
  todosVanzeiros?: boolean;
};

/**
 * Agrupamento que NÃO é pai (não tem filha): pai e filhas somariam o mesmo pagamento duas vezes.
 *
 * O NOT IN sem correlação é avaliado uma vez só (SubPlan em hash). O NOT EXISTS correlacionado deixava o planner
 * escolher um nested loop anti join que lê as ~340 mil linhas de ordem_pagamento_agrupado (sem índice em
 * "ordemPagamentoAgrupadoId") uma vez por linha de resultado: a Movimentação Financeira levava mais de 110 s para 2 dias
 * (3 s com o NOT IN, mesmo resultado linha a linha). O IS NOT NULL dentro do subselect é obrigatório: um NULL no NOT IN
 * descartaria todas as linhas. Mesma solução do builder de guardadores (GUARDADOR_OPA_WITHOUT_CHILDREN).
 */
export const agrupamentoSemFilhas = (alias: string) => `${alias}.id NOT IN (
        SELECT filha."ordemPagamentoAgrupadoId"
        FROM ordem_pagamento_agrupado filha
        WHERE filha."ordemPagamentoAgrupadoId" IS NOT NULL
      )`;

export const CONSORCIO_CASE = `
  CASE
    WHEN pu."permitCode" = '8' THEN 'VLT'
    WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
    WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
    WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
    ELSE op."nomeConsorcio"
  END
`;

// Consórcio da Eleição pelo permitCode do favorecido, igual ao Consolidado (consorcioCaseEleicao)
// - regra de Rayanne, 2026-11-11. O "consorcio" gravado em ordem_pagamento_unico muitas vezes não
// é o do favorecido, e filtrar por ele fazia STPC/STPL/TEC divergirem entre os dois relatórios.
export const ELEICAO_CONSORCIO_CASE = `
  CASE
    WHEN pu."permitCode" = '8' THEN 'VLT'
    WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
    WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
    WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
    ELSE opu."consorcio"
  END
`;

// Filtro de consorcio da Eleicao: o mesmo permitCode, lido da propria ordem ("idOperadora" e' o
// permitCode do operador dono da ordem - ver buildEleicaoQuery), sem depender do usuario. Filtrar
// pelo CASE de "pu" obrigava a busca de usuario (LATERAL) a rodar antes do filtro e levou a
// consulta de STPC/STPL de 3-5 s para mais de 180 s em homologacao (2026-11-11). Ordens antigas sem
// "idOperadora" ficam com o "consorcio" da ordem. O Consolidado usa o mesmo filtro.
export const eleicaoConsorcioFiltroCase = (ordem: string) => `
  CASE
    WHEN ${ordem}."idOperadora" = '8' THEN 'VLT'
    WHEN ${ordem}."idOperadora" LIKE '4%' THEN 'STPC'
    WHEN ${ordem}."idOperadora" LIKE '81%' THEN 'STPL'
    WHEN ${ordem}."idOperadora" LIKE '7%' THEN 'TEC'
    ELSE ${ordem}."consorcio"
  END
`;

export const STATUS_CASE = `
  CASE
    WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;

const buildStatusCase = (historyAlias: string) => `
  CASE
    WHEN ${historyAlias}."statusRemessa" = 5 THEN 'Pendencia Paga'
    WHEN ${historyAlias}."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN ${historyAlias}."statusRemessa" IN (0,1) THEN 'A Pagar'
    WHEN ${historyAlias}."motivoStatusRemessa" IN ('00', 'BD') OR ${historyAlias}."statusRemessa" = 3 THEN 'Pago'
    WHEN ${historyAlias}."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;

// statusRemessa IN (0,1) precisa da mesma faixa 'A Pagar' do STATUS_CASE normal: sem ela, toda
// ordem de Eleição ainda não paga caía no ELSE 'Rejeitado' (achado testando contra produção,
// 19/10/2026: 1326 linhas com statusRemessa=1 - todas "A Pagar" - exibidas como "Rejeitado").
export const ELEICAO_STATUS_CASE = `
  CASE
    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;

// Sem nenhum status aplicável à Eleição selecionado (ex.: só "Pendentes"/"Pendencia Paga"
// marcados, que não existem no vocabulário de ELEICAO_STATUS_CASE), a query deve não trazer
// nenhuma linha - não liberar todos os status. Um fallback "OR NOT (...)" aqui fazia o
// contrário (achado testando Eleição + Pendencia Paga: vinha também "Pago", que não estava
// selecionado).
export const ELEICAO_STATUS_FILTER = `
  (
    $4::text[] IS NULL
    OR ${ELEICAO_STATUS_CASE} = ANY($4)
  )
`;

export const NOT_CPF_FILTER = `
  AND pu."cpfCnpj" NOT IN (
    '18201378000119',
    '12464869000176',
    '12464539000180',
    '12464553000184',
    '44520687000161',
    '12464577000133'
  )
`;

// "Favorecido = Todos" só deve trazer favorecidos pagos avulso/individualmente - os modais
// STPC/STPL/TEC - nunca favorecido de consórcio comum (Internorte, Santa Cruz etc.), que só
// deveria aparecer agregado via o filtro de Consórcio (CONTEXT.md, "Regras de negócio", achado
// 2026-11-04). O Consolidado (getQueryVanzeiros) já restringe assim; aqui por pu."permitCode"
// (não op."nomeConsorcio"/CONSORCIO_CASE) porque buildEleicaoQuery não tem a tabela "op"
// principal joinada, só "pu" - mesmas faixas usadas em CONSORCIO_CASE para STPC/STPL/TEC
// (VLT, permitCode='8', fica de fora: é pago por consórcio, não avulso).
export const MODAIS_FILTER = `
  AND (pu."permitCode" LIKE '4%' OR pu."permitCode" LIKE '81%' OR pu."permitCode" LIKE '7%')
`;

// NOT_CPF_FILTER e MODAIS_FILTER só valem quando, além de nenhum favorecido específico ter sido
// selecionado, nenhum Consórcio foi selecionado (ADR 0018): o pagamento de um consórcio (VLT,
// Internorte, Santa Cruz etc.) é lançado no CNPJ institucional dele - excluí-lo mesmo com o
// consórcio escolhido fazia a Movimentação Financeira mostrar R$ 0,00 onde o Consolidado mostra
// o valor certo (achado 2026-11-06). Uma vez que o usuário pediu um Consórcio (específico ou
// "Todos"), é o filtro de consórcio (consorcioParam/CONSORCIO_CASE) que decide quais linhas
// aparecem, não estes dois.
const buildTodosVanzeirosFilter = (params: NovoRemessaBaseParams) => {
  if (!params.todosVanzeiros || params.hasConsorcioFilter) return '';
  return `${NOT_CPF_FILTER}${MODAIS_FILTER}`;
};

/**
 * buildBaseQuery/buildStucGratuidadeQuery (e as duas famílias de dia único abaixo) só
 * diferem na origem do agrupamento (normal vs gratuidade) e na coluna de valor - os
 * templates abaixo capturam essa diferença uma vez, para as duas famílias não divergirem
 * silenciosamente entre si (ex.: um fix no filtro de valor aplicado só numa das duas).
 */
type AgrupamentoSource = {
  /** Coluna de ordem_pagamento usada para chegar no agrupamento (normal ou de gratuidade). */
  agrupamentoJoinColumn: 'ordemPagamentoAgrupadoId' | 'ordemPagamentoAgrupadoGratuidadeId';
  /** Expressão (com alias) da coluna de valor. */
  valorSelect: string;
  /** Filtro extra de WHERE (sem o "AND" final), ou undefined para o fluxo normal. */
  extraWhere?: string;
  /**
   * AGRUPAMENTO_NORMAL soma várias OrdemPagamento num único detalhe_a/valorLancamento (o
   * valor do lote, não de uma ordem - CONTEXT.md, glossário "OrdemPagamentoAgrupado"). Sem
   * restringir a uma ordem representante por agrupamento, uma linha por ordem filha repete o
   * mesmo valorLancamento e o SUM() do service soma o mesmo lançamento uma vez por ordem
   * agrupada (ADR 0011, corrige o ADR 0010). AGRUPAMENTO_GRATUIDADE não liga isso: cada ordem
   * tem seu próprio valorGratuidade, genuinamente por ordem (ADR 0007).
   */
  umaOrdemPorAgrupamento?: boolean;
  /**
   * Override de "dataReferencia" para buildPendenciaPagamentoTemplate (Estorno/Rejeitado).
   * Por padrão esse template usa a data de pagamento da tentativa (op_pai/opa."dataPagamento")
   * - undefined mantém esse comportamento (AGRUPAMENTO_NORMAL). AGRUPAMENTO_GRATUIDADE precisa
   * do dia real de cada ordem (da."dataVencimento") para o pivot de janela de pagamento (ADR
   * 0012/pivotStucGratuidadeRows) conseguir separar os dias da janela - usar a data de pagamento
   * aqui colapsaria os dias distintos de uma mesma janela em uma única linha.
   */
  dataReferenciaPendenciaPagamento?: string;
  /**
   * Uma filha paga pela pai (Pendência Paga) guarda os detalhe_a de todas as tentativas antigas,
   * e cada linha repetia a filha no relatório (08/06/2026: R$ 4.497,60 a mais que o extrato).
   * Mantém uma só linha por filha: a de mesmo valor do valorTotal da filha, senão a mais recente.
   */
  umaLinhaPorFilhaPaga?: boolean;
  /**
   * Override de "dataReferencia" para buildGroupedQuery/buildPendenciaPagaTemplate. Por padrão
   * (undefined) é da."dataVencimento" (a data de pagamento do lote, AGRUPAMENTO_NORMAL).
   * AGRUPAMENTO_GRATUIDADE agrupa várias ordens no mesmo lote (mesmo detalhe_a), então
   * da."dataVencimento" é igual para toda ordem irmã e o pivot de janela (ADR 0012/
   * pivotStucGratuidadeRows) não consegue separar os dias - toda ordem cai na mesma coluna e é
   * somada ali, com a data do lote em vez do dia real exibida na coluna (achado testando contra
   * produção, 2026-10-26). Usa o dia da própria ordem para o pivot conseguir espalhar as colunas.
   */
  dataReferenciaGrouped?: string;
};

const AGRUPAMENTO_NORMAL: AgrupamentoSource = {
  agrupamentoJoinColumn: 'ordemPagamentoAgrupadoId',
  valorSelect: 'da."valorLancamento" AS valor',
  umaOrdemPorAgrupamento: true,
  umaLinhaPorFilhaPaga: true,
};

const AGRUPAMENTO_GRATUIDADE: AgrupamentoSource = {
  agrupamentoJoinColumn: 'ordemPagamentoAgrupadoGratuidadeId',
  valorSelect: 'op."valorGratuidade" AS valor',
  extraWhere: 'op."valorGratuidade" IS NOT NULL AND op."valorGratuidade" <> 0',
  dataReferenciaPendenciaPagamento: 'da."dataVencimento"',
  dataReferenciaGrouped: 'DATE(op."dataOrdem")',
};

/**
 * Início do FROM dos templates: o agrupamento e a ordem de pagamento dele.
 *
 * Quando só interessa uma ordem por agrupamento (AGRUPAMENTO_NORMAL), a ordem representante (a de menor id) vem de uma
 * LATERAL que para na primeira ordem do índice. O filtro antigo `op.id = (SELECT MIN(o.id) ...)` obrigava o planner a
 * juntar ordem_pagamento inteira e testar o MIN por linha: a consulta base de 88 dias caiu de 2,5 s para 0,9 s no banco de
 * teste, com a mesma contagem e o mesmo total. Gratuidade usa todas as ordens (valorGratuidade é por ordem) e mantém o join
 * direto.
 */
const fromOrdemEAgrupamento = (source: AgrupamentoSource) =>
  source.umaOrdemPorAgrupamento
    ? `FROM ordem_pagamento_agrupado opa
    INNER JOIN LATERAL (
      SELECT o.* FROM ordem_pagamento o
      WHERE o."${source.agrupamentoJoinColumn}" = opa.id
      ORDER BY o.id
      LIMIT 1
    ) op ON true`
    : `FROM ordem_pagamento op
    INNER JOIN ordem_pagamento_agrupado opa
      ON op."${source.agrupamentoJoinColumn}" = opa.id`;

const umaOrdemPorAgrupamentoFilter = (source: AgrupamentoSource) =>
  source.umaOrdemPorAgrupamento
    ? `AND op.id = (
        SELECT MIN(o.id) FROM ordem_pagamento o WHERE o."${source.agrupamentoJoinColumn}" = opa.id
      )`
    : '';

const umaLinhaPorFilhaPagaFilter = (source: AgrupamentoSource) =>
  source.umaLinhaPorFilhaPaga
    ? `AND da.id = (
        SELECT da_filha.id
        FROM ordem_pagamento_agrupado_historico oph_filha
        INNER JOIN detalhe_a da_filha
          ON da_filha."ordemPagamentoAgrupadoHistoricoId" = oph_filha.id
        WHERE oph_filha."ordemPagamentoAgrupadoId" = opa.id
          AND oph_filha."statusRemessa" = 5
        ORDER BY
          (ROUND(da_filha."valorLancamento"::numeric, 2) = ROUND(opa."valorTotal"::numeric, 2)) DESC,
          da_filha.id DESC
        LIMIT 1
      )`
    : '';

// Sem DISTINCT (ver ADR 0007): a lista de colunas não inclui op.id, só opa.id (o agrupamento).
// Quando duas ordens de pagamento distintas do mesmo agrupamento coincidem em valor, DISTINCT
// as colapsava em uma só, subcontando o total de Consolidado e Movimentação Financeira.
const buildGroupedQuery = (params: NovoRemessaBaseParams, source: AgrupamentoSource) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT
      ${source.dataReferenciaGrouped ?? 'da."dataVencimento"'} AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ${source.valorSelect},
      CASE
        WHEN oph."statusRemessa" = 5
          AND opa."ordemPagamentoAgrupadoId" IS NOT NULL
          THEN op_pai."dataPagamento"
        ELSE opa."dataPagamento"
      END AS "dataPagamento",
      ${STATUS_CASE} AS status,
      ${buildCodigoErroSql(STATUS_CASE)} AS "codigoErro"
    ${fromOrdemEAgrupamento(source)}
    LEFT JOIN ordem_pagamento_agrupado op_pai
      ON op_pai.id = opa."ordemPagamentoAgrupadoId"
    INNER JOIN ordem_pagamento_agrupado_historico oph
      ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN public."user" pu
      ON pu.id = op."userId"
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      ${source.extraWhere ? `${source.extraWhere}\n      AND ` : ''}da."dataVencimento"::date BETWEEN $1::date AND $2::date
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR ${STATUS_CASE} = ANY($4))
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND ${agrupamentoSemFilhas('opa')}
      AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
      ${buildTodosVanzeirosFilter(params)}
  `;
};

// Sem DISTINCT (ver ADR 0007/TD-14): a lista de colunas não inclui op.id, só opa.id.
// Duas ordens de pagamento distintas do mesmo agrupamento que coincidem em valor eram
// colapsadas em uma só, subcontando o total de Pendência Paga.
const buildPendenciaPagaTemplate = (params: NovoRemessaBaseParams, source: AgrupamentoSource) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT
      ${source.dataReferenciaGrouped ?? 'da."dataVencimento"'} AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ${source.valorSelect},
      CASE
        WHEN oph."statusRemessa" = 5
          AND opa."ordemPagamentoAgrupadoId" IS NOT NULL
          THEN op_pai."dataPagamento"
        ELSE opa."dataPagamento"
      END AS "dataPagamento",
      ${STATUS_CASE} AS status,
      NULL::text AS "codigoErro"
      ${fromOrdemEAgrupamento(source)}
      LEFT JOIN ordem_pagamento_agrupado op_pai
        ON op_pai.id = opa."ordemPagamentoAgrupadoId"
      INNER JOIN ordem_pagamento_agrupado_historico oph
        ON oph."ordemPagamentoAgrupadoId" = opa.id
      INNER JOIN detalhe_a da
        ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
      INNER JOIN public."user" pu
        ON pu.id = op."userId"
      INNER JOIN bank bc
        ON bc.code = pu."bankCode"
    WHERE
      ${source.extraWhere ? `${source.extraWhere}\n      AND ` : ''}($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND ${agrupamentoSemFilhas('opa')}
      AND oph."statusRemessa" = 5
      AND (
        (
          opa."ordemPagamentoAgrupadoId" IS NOT NULL
          AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
        )
        OR (
          opa."ordemPagamentoAgrupadoId" IS NULL
          AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date
        )
      )
      AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
      ${umaLinhaPorFilhaPagaFilter(source)}
      ${buildTodosVanzeirosFilter(params)}
  `;
};

// O caso de exemplo original deste comentário (2026-04-02, CPF 29709920782, opa.id=253902)
// foi diagnosticado errado: não são 3 lançamentos distintos de R$12,38 que coincidem em
// valor, é 1 único lançamento (da.id=21536) com 3 ordens de pagamento filhas do mesmo
// agrupamento - o mesmo mecanismo do ADR 0011 abaixo, não o do ADR 0007. Ver ADR 0011.
const buildPendenciaPagamentoTemplate = (
  params: NovoRemessaBaseParams,
  source: AgrupamentoSource,
) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  const parentStatusCase = buildStatusCase('oph_pai');
  const requestedStatuses = params.parentErrorStatuses?.length
    ? params.parentErrorStatuses
    : ['Estorno', 'Rejeitado'];
  const requestedStatusSql = requestedStatuses.map((status) => `'${status}'`).join(', ');
  const bloqueadoFilter = params.desativados
    ? 'AND pu.bloqueado = true'
    : 'AND (pu.bloqueado IS NULL OR pu.bloqueado = false)';

  return `
    SELECT
      ${source.dataReferenciaPendenciaPagamento ?? 'op_pai."dataPagamento"'} AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ${source.valorSelect},
      opa."dataPagamento" AS "dataPagamento",
      ${parentStatusCase} AS status,
      ${buildCodigoErroSql(parentStatusCase, 'oph_pai')} AS "codigoErro"
    ${fromOrdemEAgrupamento(source)}
    INNER JOIN ordem_pagamento_agrupado op_pai
      ON op_pai.id = opa."ordemPagamentoAgrupadoId"
    INNER JOIN ordem_pagamento_agrupado_historico oph
      ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN ordem_pagamento_agrupado_historico oph_pai
      ON oph_pai.id = (
        SELECT MAX(oph_mais_recente.id)
        FROM ordem_pagamento_agrupado_historico oph_mais_recente
        WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = op_pai.id
      )
    INNER JOIN public."user" pu
      ON pu.id = op."userId"
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      ${source.extraWhere ? `${source.extraWhere}\n      AND ` : ''}op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND ${parentStatusCase} IN (${requestedStatusSql})
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND (oph_pai."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph_pai."motivoStatusRemessa" IS NULL)
      ${bloqueadoFilter}
      ${buildTodosVanzeirosFilter(params)}

    UNION ALL

    -- Estorno/Rejeitado sem pai (nunca tiveram uma tentativa anterior/retentativa): a família
    -- acima exige opa."ordemPagamentoAgrupadoId" via INNER JOIN, então esses registros de
    -- primeiro nível ficavam de fora do filtro de dia único (apareciam só em intervalos de
    -- mais de um dia, via buildBaseQuery). Aqui usamos a própria data/status do registro.
    -- Sem DISTINCT (mesmo raciocínio do ADR 0007): a lista de colunas não inclui op.id, só
    -- opa.id, e duas ordens de pagamento distintas do mesmo agrupamento podem coincidir em
    -- todos os outros campos - DISTINCT as colapsaria em uma só, subcontando o total.
    SELECT
      ${source.dataReferenciaPendenciaPagamento ?? 'opa."dataPagamento"'} AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ${source.valorSelect},
      opa."dataPagamento" AS "dataPagamento",
      ${STATUS_CASE} AS status,
      ${buildCodigoErroSql(STATUS_CASE)} AS "codigoErro"
    ${fromOrdemEAgrupamento(source)}
    INNER JOIN ordem_pagamento_agrupado_historico oph
      ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN public."user" pu
      ON pu.id = op."userId"
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      ${source.extraWhere ? `${source.extraWhere}\n      AND ` : ''}opa."ordemPagamentoAgrupadoId" IS NULL
      AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND ${STATUS_CASE} IN (${requestedStatusSql})
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND ${agrupamentoSemFilhas('opa')}
      AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
      ${bloqueadoFilter}
      ${buildTodosVanzeirosFilter(params)}
  `;
};

export const buildBaseQuery = (params: NovoRemessaBaseParams) => buildGroupedQuery(params, AGRUPAMENTO_NORMAL);

export const buildEleicaoQuery = (params: NovoRemessaBaseParams) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT DISTINCT
      da."dataVencimento" AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj",
      ${ELEICAO_CONSORCIO_CASE} AS "nomeConsorcio",
      da."valorLancamento" AS valor,
      da."dataVencimento" AS "dataPagamento",
      ${ELEICAO_STATUS_CASE} AS status,
      ${buildCodigoErroSql(ELEICAO_STATUS_CASE)} AS "codigoErro"
    FROM
      ordem_pagamento_agrupado opa
    INNER JOIN ordem_pagamento_agrupado_historico oph
      ON oph."ordemPagamentoAgrupadoId" = opa.id
    INNER JOIN detalhe_a da
      ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    INNER JOIN ordem_pagamento_unico opu
      ON opu."idOrdemPagamento" = opa.id::VARCHAR
    -- Por permitCode/idOperadora, não por cpfCnpj: "user"."cpfCnpj" não é único (achado contra
    -- stag, 19/10/2026 - um favorecido tinha 2 cadastros ativos com o mesmo CPF, nenhum
    -- deletedAt/bloqueado). Ligar por cpfCnpj faz fan-out - a mesma ordem vira 2 linhas, uma por
    -- cadastro, dobrando o valor dela no total. "idOperadora" é o permitCode do operador dono
    -- da ordem (não o CPF dele), então é a chave correta mesmo com CPF duplicado.
    -- Fallback por operadoraCpfCnpj (ADR 0019) só quando nenhum usuário tem esse permitCode -
    -- ordens antigas (ex. nov/2024) têm "idOperadora" NULL, campo ainda não preenchido na época,
    -- então o join acima não encontra ninguém e a ordem desaparecia do relatório (achado
    -- 2026-11-06). Verificado contra o banco: essa população não tem CPF duplicado, então o
    -- fallback não reintroduz o fan-out que motivou a troca para permitCode.
    INNER JOIN LATERAL (
      SELECT u.* FROM public."user" u
      WHERE u."permitCode" = opu."idOperadora"
      UNION ALL
      SELECT u.* FROM public."user" u
      WHERE NOT EXISTS (
        SELECT 1 FROM public."user" u2 WHERE u2."permitCode" = opu."idOperadora"
      )
      AND u."cpfCnpj" = opu."operadoraCpfCnpj"
    ) pu ON true
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      da."dataVencimento"::date BETWEEN $1::date AND $2::date
      AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
      AND ${ELEICAO_STATUS_FILTER}
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${eleicaoConsorcioFiltroCase('opu')})) = ANY(${consorcioParam}))
      ${buildTodosVanzeirosFilter(params)}
  `;
};

// Eleicao "A Pagar": ordem_pagamento_unico ainda sem agrupamento (idOrdemPagamento NULL), pela data
// da ordem - mesma fonte do Consolidado (getQueryApagarEleicao*). Mesmas colunas e ligacao de
// usuario de buildEleicaoQuery, para as duas entrarem na mesma uniao.
export const buildEleicaoAPagarQuery = (params: NovoRemessaBaseParams) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT DISTINCT
      opu."dataOrdem"::date::timestamp AS "dataReferencia",
      opu.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj",
      ${ELEICAO_CONSORCIO_CASE} AS "nomeConsorcio",
      opu."valorTotalTransacaoLiquido" AS valor,
      NULL::timestamp AS "dataPagamento",
      'A Pagar' AS status,
      NULL::text AS "codigoErro"
    FROM ordem_pagamento_unico opu
    INNER JOIN LATERAL (
      SELECT u.* FROM public."user" u
      WHERE u."permitCode" = opu."idOperadora"
      UNION ALL
      SELECT u.* FROM public."user" u
      WHERE NOT EXISTS (
        SELECT 1 FROM public."user" u2 WHERE u2."permitCode" = opu."idOperadora"
      )
      AND u."cpfCnpj" = opu."operadoraCpfCnpj"
    ) pu ON true
    LEFT JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      opu."dataOrdem"::date BETWEEN $1::date AND $2::date
      AND opu."idOrdemPagamento" IS NULL
      AND ($3::integer[] IS NULL OR pu."id" = ANY($3))
      AND ($4::text[] IS NULL OR 'A Pagar' = ANY($4))
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${eleicaoConsorcioFiltroCase('opu')})) = ANY(${consorcioParam}))
      ${buildTodosVanzeirosFilter(params)}
  `;
};

export const buildStucGratuidadeQuery = (params: NovoRemessaBaseParams) => buildGroupedQuery(params, AGRUPAMENTO_GRATUIDADE);

export const buildPendentesQuery = (params: NovoRemessaPendentesParams) => {
  return `
    SELECT DISTINCT
      DATE(op."dataOrdem") AS "dataReferencia",
      NULL::integer AS id,
      op."nomeOperadora" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      op.valor AS valor,
      op."dataOrdem" AS "dataPagamento",
      '${StatusPagamento.PENDENTES}' AS status,
      NULL::text AS "codigoErro"
    FROM ordem_pagamento op
    INNER JOIN public."user" pu
      ON pu.id = op."userId"
    INNER JOIN bank bc
      ON bc.code = pu."bankCode"
    WHERE
      op."dataOrdem" BETWEEN $1 AND $2
      AND op."ordemPagamentoAgrupadoId" IS NULL
      AND ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND UPPER(TRIM(${CONSORCIO_CASE})) = ANY(
        COALESCE(NULLIF($5::text[], '{}'), ARRAY['STPC','STPL','TEC'])
      )
      AND (
        ($6::numeric IS NULL OR op.valor >= $6::numeric)
        AND ($7::numeric IS NULL OR op.valor <= $7::numeric)
      )
      ${params.todosVanzeiros ? NOT_CPF_FILTER : ''}
  `;
};

export const buildPendenciaPagaSingleDateQuery = (params: NovoRemessaBaseParams) =>
  buildPendenciaPagaTemplate(params, AGRUPAMENTO_NORMAL);

// Filhas PASSO 0: pendências pagas (status 5) que nunca foram enviadas em arquivo próprio, então
// nenhum histórico delas tem detalhe_a e o INNER JOIN de buildPendenciaPagaTemplate as descarta.
// Valor = valorTotal da OPA da filha (cada filha tem de 1 a N ordem_pagamento que somam esse
// valor, então só a ordem de menor id representa a filha) e data = dataPagamento da pai.
// Fica numa consulta separada, e não num UNION ALL dentro do template, porque o service anexa
// "AND pu.bloqueado = true" ao final do SQL de cada consulta.
export const buildPendenciaPagaPasso0Query = (params: NovoRemessaBaseParams) => {
  const consorcioParam = `$${params.consorcioFilterParamIndex}`;
  return `
    SELECT
      oph."dataReferencia" AS "dataReferencia",
      opa.id,
      pu."fullName" AS nomes,
      pu.email,
      pu."bankCode" AS "codBanco",
      bc.name AS "nomeBanco",
      pu."cpfCnpj" AS "cpfCnpj",
      ${CONSORCIO_CASE} AS "nomeConsorcio",
      ROUND(opa."valorTotal"::numeric, 2) AS valor,
      op_pai."dataPagamento" AS "dataPagamento",
      'Pendencia Paga' AS status,
      NULL::text AS "codigoErro"
      FROM ordem_pagamento op
      INNER JOIN ordem_pagamento_agrupado opa
        ON op."ordemPagamentoAgrupadoId" = opa.id
      INNER JOIN ordem_pagamento_agrupado op_pai
        ON op_pai.id = opa."ordemPagamentoAgrupadoId"
      INNER JOIN ordem_pagamento_agrupado_historico oph
        ON oph.id = (
          SELECT MAX(oph_mais_recente.id)
          FROM ordem_pagamento_agrupado_historico oph_mais_recente
          WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = opa.id
        )
      INNER JOIN public."user" pu
        ON pu.id = op."userId"
      INNER JOIN bank bc
        ON bc.code = pu."bankCode"
    WHERE
      ($3::integer[] IS NULL OR pu.id = ANY($3))
      AND ($4::text[] IS NULL OR TRUE)
      AND (${consorcioParam}::text[] IS NULL OR UPPER(TRIM(${CONSORCIO_CASE})) = ANY(${consorcioParam}))
      AND ${agrupamentoSemFilhas('opa')}
      AND oph."statusRemessa" = 5
      AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
      AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM ordem_pagamento_agrupado_historico oph_qualquer
        INNER JOIN detalhe_a da_qualquer
          ON da_qualquer."ordemPagamentoAgrupadoHistoricoId" = oph_qualquer.id
        WHERE oph_qualquer."ordemPagamentoAgrupadoId" = opa.id
      )
      ${umaOrdemPorAgrupamentoFilter(AGRUPAMENTO_NORMAL)}
      ${buildTodosVanzeirosFilter(params)}
  `;
};

export const buildStucGratuidadePendenciaPagaSingleDateQuery = (params: NovoRemessaBaseParams) =>
  buildPendenciaPagaTemplate(params, AGRUPAMENTO_GRATUIDADE);

export const buildStucGratuidadePendenciaPagamentoSingleDateQuery = (params: NovoRemessaBaseParams) =>
  buildPendenciaPagamentoTemplate(params, AGRUPAMENTO_GRATUIDADE);

export const buildPendenciaPagamentoSingleDateQuery = (params: NovoRemessaBaseParams) =>
  buildPendenciaPagamentoTemplate(params, AGRUPAMENTO_NORMAL);
