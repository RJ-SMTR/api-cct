export const MODAIS: readonly string[] = ['STPC', 'STPL', 'TEC'];

export const CONSORCIOS: readonly string[] = [
  'VLT',
  'Intersul',
  'Transcarioca',
  'Internorte',
  'MobiRio',
  'Santa Cruz',
  'MOBI-Rio BUM',
  'TUSE',
  'STPC',
  'STPL',
  'TEC',
  'GTU',
];

// CPFs/CNPJs institucionais dos consórcios (NOT_CPF_FILTER em novo-remessa-query-builder.ts) -
// excluidos de "Favorecido = Todos" sem consorcio selecionado, incluidos quando um consorcio
// especifico ou "Todos os consorcios" e escolhido (ADR 0018).
export const INSTITUTIONAL_CPF_CNPJ: readonly string[] = [
  '18201378000119',
  '12464869000176',
  '12464539000180',
  '12464553000184',
  '44520687000161',
  '12464577000133',
];

export const buildConsorcioCaseSql = (userAlias: string, ordemAlias: string) => `CASE
    WHEN ${userAlias}."permitCode" = '8' THEN 'VLT'
    WHEN ${userAlias}."permitCode" LIKE '4%' THEN 'STPC'
    WHEN ${userAlias}."permitCode" LIKE '81%' THEN 'STPL'
    WHEN ${userAlias}."permitCode" LIKE '7%' THEN 'TEC'
    ELSE ${ordemAlias}."nomeConsorcio"
  END`;

// Consorcio do pagamento do Permissionario nos relatorios v2 (Consolidado e Movimentacao Financeira): o
// nomeConsorcio da propria ordem, como o Dashboard de Pagamentos (regra de Rayanne, 2026-11-19: um
// favorecido com permitCode de STPC e ordens de STPL saia em STPC nos relatorios e em STPL no dashboard).
// O permitCode so decide quando a ordem nao tem consorcio. buildConsorcioCaseSql (permitCode primeiro)
// continua valendo para o legado, STUC-Gratuidade e Eleicao. O BTRIM tira tambem quebra de linha e tab: ha
// ordem gravada com 'STPC\n', que o TRIM comum deixaria fora do filtro de consorcio.
export const buildConsorcioDaOrdemSql = (userAlias: string, ordemAlias: string) =>
  `COALESCE(NULLIF(BTRIM(${ordemAlias}."nomeConsorcio", E' \\t\\r\\n'), ''), ${buildConsorcioCaseSql(userAlias, ordemAlias)})`;
