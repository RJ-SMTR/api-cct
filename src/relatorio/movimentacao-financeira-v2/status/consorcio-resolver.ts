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

export const buildConsorcioCaseSql = (userAlias: string, ordemAlias: string) => `CASE
    WHEN ${userAlias}."permitCode" = '8' THEN 'VLT'
    WHEN ${userAlias}."permitCode" LIKE '4%' THEN 'STPC'
    WHEN ${userAlias}."permitCode" LIKE '81%' THEN 'STPL'
    WHEN ${userAlias}."permitCode" LIKE '7%' THEN 'TEC'
    ELSE ${ordemAlias}."nomeConsorcio"
  END`;
