import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import {
  pendenciaAgrupamentoNuncaEnviadoGuardador,
  pendenciaOrdemSoltaGuardador,
  pendenciaOrdemSoltaPermissionario,
  pendenciaRejeitadaGuardador,
  pendenciaRejeitadaPermissionario,
} from '../../novo-remessa/queries/regras-pendencia';
import { GUARDADOR_CONSORCIO_CASE } from '../../novo-remessa/queries/guardador-novo-remessa-query-builder';
import { buildConsorcioCaseSql, CONSORCIOS, INSTITUTIONAL_CPF_CNPJ, MODAIS } from '../status/consorcio-resolver';
import { buildEleicaoStatusPagamentoCaseSql, buildStatusPagamentoCaseSql } from '../status/status-resolver';

export type Perfil = 'permissionario' | 'guardador';

export interface BasePagamentoFilter {
  dataInicio: Date;
  dataFim: Date;
  statuses?: StatusPagamento[];
  valorMin?: number;
  valorMax?: number;
  // Favorecido/Consorcio/Modal (T3, Permissionario apenas - Guardador nesta camada so suporta
  // userIds, sem a distincao modal/consorcio que nao existe nesse perfil). "Nenhum selecionado"
  // (nem userIds nem consorcio) normaliza para o mesmo comportamento de todosVanzeiros=true
  // (ADR 0014), aplicado dentro do repository - nao precisa ser setado explicitamente pelo
  // chamador.
  userIds?: number[];
  consorcioNome?: string[];
  todosConsorcios?: boolean;
  // Sem o flag, favorecido bloqueado fica de fora; com ele, so os bloqueados. Ordem sem usuario
  // (pu NULL) continua visivel no modo padrao e nunca aparece em desativados.
  desativados?: boolean;
}

export interface BasePagamentoRow {
  dataReferencia: Date;
  nomes: string;
  cpfCnpj: string;
  nomeConsorcio: string | null;
  valor: string;
  status: StatusPagamento;
  // Chave estavel por linha (ver CURSOR_ORDER_BY); ausente nas linhas de Eleicao, que nao paginam
  // por cursor. Nunca vai para as colunas de saida (toExportRow escolhe os campos).
  chaveLinha?: string;
}

// Keyset cursor (T4, AC-19/ADR 0002): every field of BasePagamentoRow doubles as a
// tie-breaker, in the exact order used by CURSOR_ORDER_BY/CURSOR_TUPLE_COMPARE below - not
// opaque to the frontend (ADR 0021 decision 6), same as the legacy Guardador cursor shape. Not
// a subset (the bug this fixes, in the legacy Permissionario cursor, was using fewer columns
// than the "grouped" source actually distinguishes rows by).
export interface BasePagamentoCursor {
  dataReferencia: Date | string | null;
  nomes: string | null;
  cpfCnpj: string | null;
  nomeConsorcio: string | null;
  status: string | null;
  valor: string | null;
  // Opcional: um cliente que ainda nao envia cursorChaveLinha continua paginando pelas 6 colunas.
  chaveLinha?: string | null;
}

export interface BasePagamentoPage {
  rows: BasePagamentoRow[];
  // null means "no more rows" - never a cursor that would repeat the last page.
  nextCursor: BasePagamentoCursor | null;
}

// Mesma lista de expressoes no ORDER BY e na comparacao de tupla do keyset: com ORDER BY na
// coluna pura, NULL ordena por ultimo mas COALESCE(nomes, '') o trata como menor valor, e a linha
// sem favorecido sumia num corte de pagina. Row comparison do Postgres tambem nao aceita NULL, por
// isso o COALESCE nos dois lados. Efeito visivel: linhas sem favorecido vem primeiro no seu dia.
const CURSOR_TUPLE = `
  "dataReferencia",
  COALESCE(nomes, ''),
  COALESCE("cpfCnpj", ''),
  COALESCE("nomeConsorcio", ''),
  COALESCE(status, ''),
  COALESCE(valor::numeric, 0)
`;

// chaveLinha desempata linhas identicas nas 6 colunas (que o keyset perdia num corte de pagina):
// prefixo da fonte + id da linha, sempre texto, comparado na collation padrao como o ORDER BY.
const CURSOR_ORDER_BY = `${CURSOR_TUPLE}, "chaveLinha"`;

// Dois pontos de resolucao porque os aliases disponiveis diferem por fonte: "nunca_enviada" tem a
// tabela de ordem em si (op), "agrupada" so tem o representante trazido pela LATERAL. Guardador
// resolve pela associacao (mesmo CASE do legado, depende do join com "assoc" abaixo).
const NOME_CONSORCIO_NUNCA_ENVIADA: Record<Perfil, string> = {
  permissionario: buildConsorcioCaseSql('pu', 'op'),
  guardador: GUARDADOR_CONSORCIO_CASE,
};

const NOME_CONSORCIO_AGRUPADA: Record<Perfil, string> = {
  permissionario: buildConsorcioCaseSql('pu', 'representante'),
  guardador: GUARDADOR_CONSORCIO_CASE,
};

// public."user"."roleId" do guardador (associacoes tem pagamento proprio, mas nao sao guardadores).
const GUARDADOR_ROLE_ID = 6;

// Associacoes agregadas uma vez por usuario (um guardador pode ter mais de uma): o join nao
// multiplica a linha de pagamento. Mesmo desenho do legado (GUARDADOR_ASSOCIACAO_CTE).
const ASSOCIACAO_CTE: Record<Perfil, string> = {
  permissionario: '',
  guardador: `assoc AS MATERIALIZED (
        SELECT
          ur.user_id,
          STRING_AGG(a."fullName", ' / ' ORDER BY a."fullName") AS "fullName",
          ARRAY_AGG(UPPER(TRIM(a."fullName"))) AS "nomesUpper"
        FROM user_relationships ur
        INNER JOIN public."user" a ON a.id = ur.related_user_id
        WHERE a."fullName" IS NOT NULL
        GROUP BY ur.user_id
      ),`,
};

const ASSOCIACAO_JOIN: Record<Perfil, string> = {
  permissionario: '',
  guardador: 'LEFT JOIN assoc ON assoc.user_id = pu.id',
};

// ordem_pagamento_guardador nao tem coluna nomeConsorcio - so o Permissionario precisa dela na
// LATERAL (o alias de saida precisa se chamar "nomeConsorcio" para casar com o CASE acima).
const REPRESENTANTE_EXTRA_COLUMN: Record<Perfil, string> = {
  permissionario: ', rep."nomeConsorcio"',
  guardador: '',
};

const ORDEM_TABLE: Record<Perfil, string> = {
  permissionario: 'ordem_pagamento',
  guardador: 'ordem_pagamento_guardador',
};

// ordem_pagamento_guardador has no dataCaptura column (only dataOrdem) - it stands in as the
// "never-grouped" cutoff date for that profile.
const DATA_CAPTURA_COLUMN: Record<Perfil, string> = {
  permissionario: 'dataCaptura',
  guardador: 'dataOrdem',
};

const VALOR_COLUMN: Record<Perfil, string> = {
  permissionario: 'valor',
  guardador: 'valorRepasseGuardador',
};

// Pendencia Paga/Pendencia de Pagamento (T5, ADR 0021) sao lidas sempre pela ordem_pagamento_
// agrupado - guardador nao tem tabela propria para essas duas fontes (ordem_pagamento_guardador
// so entra via a LATERAL "representante", igual as fontes acima).
const AGRUPAMENTO_SEM_FILHAS = (alias: string) =>
  `NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado filha WHERE filha."ordemPagamentoAgrupadoId" = ${alias}.id)`;

const representanteLateral = (perfil: Perfil, ordemTable: string) => `
  INNER JOIN LATERAL (
    SELECT rep."userId"${REPRESENTANTE_EXTRA_COLUMN[perfil]} FROM ${ordemTable} rep WHERE rep."ordemPagamentoAgrupadoId" = opa.id LIMIT 1
  ) representante ON true
  LEFT JOIN public."user" pu ON pu.id = representante."userId"
  ${ASSOCIACAO_JOIN[perfil]}
`;

function resolveElegibilidadeRejeitado(perfil: Perfil): string {
  return perfil === 'guardador'
    ? pendenciaRejeitadaGuardador({ oph: 'oph', da: 'da', opa: 'opa', pu: 'pu' })
    : pendenciaRejeitadaPermissionario({ oph: 'oph', da: 'da', opa: 'opa', users: ['pu'] });
}

// T6 (ADR 0021/AC-18): "Pendentes" (OPs atrasadas) reusa regras-pendencia.ts como fonte de
// verdade - a mesma elegibilidade que a geracao real de remessa usa pra decidir o que
// reprocessar, nunca re-derivada. pendenciaOrdemSoltaPermissionario ja devolve um fragmento
// "AND ..." (espera que o chamador tenha filtrado a ordem solta antes); pendenciaOrdemSolta
// Guardador devolve uma condicao booleana completa (inclui o proprio "ordemPagamentoAgrupado
// Id IS NULL"), por isso entra entre parenteses com "AND" na frente.
function resolveElegibilidadePendenteOrdemSolta(perfil: Perfil): string {
  return perfil === 'guardador'
    ? `AND (${pendenciaOrdemSoltaGuardador('op', 'pu')})`
    : pendenciaOrdemSoltaPermissionario('op', 'pu');
}

// Mesma regra acima, mas como expressao booleana pura (sem "AND" na frente) - usada para
// EXCLUIR da fonte "A Pagar nunca enviado" o que ja e Pendente, pra nao duplicar a mesma ordem
// solta nos dois buckets (A Pagar teria janela aberta, sem corte de 10 dias/elegibilidade).
// pendenciaOrdemSoltaPermissionario devolve um fragmento "AND x AND y..."; "(TRUE AND x AND y)"
// o transforma numa condicao booleana valida sem reescrever o fragmento.
function resolveCondicaoPendenteOrdemSolta(perfil: Perfil): string {
  return perfil === 'guardador'
    ? `(${pendenciaOrdemSoltaGuardador('op', 'pu')})`
    : `(TRUE ${pendenciaOrdemSoltaPermissionario('op', 'pu')})`;
}

// Resolve a lista de nomeConsorcio aceitos no filtro final e se os CNPJs institucionais devem
// ser excluidos - so se aplica ao Permissionario (Guardador nao tem esse conceito nesta
// camada, T3). Espelha a Desired Behavior de docs/tasks/T3.md:
// - userIds especifico: sem restricao de consorcio/modal (favorecido ja escolhido a dedo).
// - consorcioNome especifico ou todosConsorcios: lista correspondente, CNPJs institucionais
//   inclusos, sem restricao a modais (ADR 0018).
// - nada selecionado (nem userIds, nem consorcio): só modais, CNPJs institucionais excluidos
//   (ADR 2026-11-04/MODAIS_FILTER) - mesmo efeito de "Favorecido = Todos" default (ADR 0014).
function resolveConsorcioFilter(perfil: Perfil, filter: BasePagamentoFilter): { nomeConsorcioList: string[] | null; excludeInstitutional: boolean } {
  if (perfil === 'guardador') {
    return { nomeConsorcioList: null, excludeInstitutional: false };
  }
  if (filter.consorcioNome?.length) {
    return { nomeConsorcioList: filter.consorcioNome.map((nome) => nome.trim().toUpperCase()), excludeInstitutional: false };
  }
  if (filter.todosConsorcios) {
    // CONSORCIOS tem grafia mista (ex. "Internorte") - uppercase aqui para casar com o
    // UPPER(TRIM(...)) aplicado na coluna (igual ao filtro de consorcioNome especifico acima;
    // achado de T3: o legado so faz UPPER(TRIM()) no branch de consorcio especifico, nao no de
    // "Todos os consorcios" - aqui os dois branches sao tratados de forma consistente).
    return { nomeConsorcioList: CONSORCIOS.map((nome) => nome.toUpperCase()), excludeInstitutional: false };
  }
  if (filter.userIds?.length) {
    return { nomeConsorcioList: null, excludeInstitutional: false };
  }
  return { nomeConsorcioList: MODAIS.map((nome) => nome.toUpperCase()), excludeInstitutional: true };
}

function condicaoBloqueado(filter: Pick<BasePagamentoFilter, 'desativados'>): string {
  return filter.desativados ? 'AND pu.bloqueado = true' : 'AND pu.bloqueado IS NOT TRUE';
}

// Filtro por favorecido comum a todas as fontes de "combinado" - um unico fragmento para nenhum
// ramo de UNION ficar sem a condicao de bloqueado.
function resolveFiltroFavorecido(perfil: Perfil, filter: BasePagamentoFilter): { sql: string; params: unknown[] } {
  const associacao = resolveFiltroAssociacao(perfil, filter);
  return {
    sql: `AND ($6::integer[] IS NULL OR pu.id = ANY($6))
          ${condicaoBloqueado(filter)}
          ${associacao.sql}`,
    params: associacao.params,
  };
}

// Guardador (legado: buildConsorcioFilter): todosConsorcios ("Todas as Associacoes") tem
// precedencia sobre consorcioNome, e os dois exigem o papel de guardador - a linha de pagamento
// da propria associacao nunca entra. Sem filtro nao ha restricao de papel aqui (ordem sem usuario
// continua visivel); o legado exige o papel sempre, divergencia registrada.
// $9 so entra na lista de parametros quando o SQL o referencia.
function resolveFiltroAssociacao(perfil: Perfil, filter: BasePagamentoFilter): { sql: string; params: unknown[] } {
  if (perfil !== 'guardador') return { sql: '', params: [] };
  if (filter.todosConsorcios) {
    return { sql: `AND pu."roleId" = ${GUARDADOR_ROLE_ID} AND assoc."nomesUpper" IS NOT NULL`, params: [] };
  }
  if (filter.consorcioNome?.length) {
    return {
      sql: `AND pu."roleId" = ${GUARDADOR_ROLE_ID} AND assoc."nomesUpper" && $9::text[]`,
      params: [filter.consorcioNome.map((nome) => nome.trim().toUpperCase())],
    };
  }
  return { sql: '', params: [] };
}

@Injectable()
export class BasePagamentoRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findGroupedRows(perfil: Perfil, filter: BasePagamentoFilter): Promise<BasePagamentoRow[]> {
    const { sql, params } = this.buildCombinadoSql(perfil, filter);
    return this.dataSource.query(`${sql}\n      ORDER BY ${CURSOR_ORDER_BY}`, params);
  }

  // Keyset-cursor pagination (T4, AC-19/ADR 0002) over the same "combinado" result as
  // findGroupedRows - never OFFSET-based, so a page cut never skips/repeats rows as the
  // underlying data is captured/updated between pages. Fetches pageSize+1 rows to know whether
  // there is a next page without a separate COUNT query; nextCursor is built from the last row
  // actually returned to the caller (never from the probe row).
  async findGroupedRowsPage(
    perfil: Perfil,
    filter: BasePagamentoFilter,
    pageSize: number,
    cursor?: BasePagamentoCursor,
  ): Promise<BasePagamentoPage> {
    const { sql, params } = this.buildCombinadoSql(perfil, filter);
    const base = params.length; // last positional param already used by buildCombinadoSql
    const tuplaCursor = `(
            $${base + 1}::date,
            COALESCE($${base + 2}::text, ''),
            COALESCE($${base + 3}::text, ''),
            COALESCE($${base + 4}::text, ''),
            COALESCE($${base + 5}::text, ''),
            COALESCE($${base + 6}::numeric, 0)
          )`;
    // Sem a chave no pedido, compara so as 6 colunas: tratar a chave ausente como '' repetiria a
    // propria linha do cursor.
    const pagedSql = `
      ${sql}
        AND (
          $${base + 1}::date IS NULL
          OR (${CURSOR_TUPLE}) > ${tuplaCursor}
          OR ($${base + 8}::text IS NOT NULL AND (${CURSOR_TUPLE}) = ${tuplaCursor} AND "chaveLinha" > $${base + 8}::text)
        )
      ORDER BY ${CURSOR_ORDER_BY}
      LIMIT $${base + 7}
    `;

    const rows: BasePagamentoRow[] = await this.dataSource.query(pagedSql, [
      ...params,
      cursor?.dataReferencia ?? null,
      cursor?.nomes ?? null,
      cursor?.cpfCnpj ?? null,
      cursor?.nomeConsorcio ?? null,
      cursor?.status ?? null,
      cursor?.valor ?? null,
      pageSize + 1,
      cursor?.chaveLinha ?? null,
    ]);

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor: BasePagamentoCursor | null =
      hasMore && lastRow
        ? {
            dataReferencia: lastRow.dataReferencia,
            nomes: lastRow.nomes,
            cpfCnpj: lastRow.cpfCnpj,
            nomeConsorcio: lastRow.nomeConsorcio,
            status: lastRow.status,
            valor: lastRow.valor,
            chaveLinha: lastRow.chaveLinha ?? null,
          }
        : null;

    return { rows: pageRows, nextCursor };
  }

  // Builds the shared "combinado" CTE chain + final filtered SELECT (everything findGroupedRows
  // and findGroupedRowsPage have in common), without ORDER BY/LIMIT so each caller can append
  // its own (plain order for a full scan, keyset WHERE + order + limit for a page).
  private buildCombinadoSql(perfil: Perfil, filter: BasePagamentoFilter): { sql: string; params: unknown[] } {
    const ordemTable = ORDEM_TABLE[perfil];
    const dataCapturaColumn = DATA_CAPTURA_COLUMN[perfil];
    const valorColumn = VALOR_COLUMN[perfil];
    const statusCase = buildStatusPagamentoCaseSql('oph');
    const { nomeConsorcioList, excludeInstitutional } = resolveConsorcioFilter(perfil, filter);
    const lateral = representanteLateral(perfil, ordemTable);
    const { sql: filtroFavorecido, params: paramsAssociacao } = resolveFiltroFavorecido(perfil, filter);
    // ADR 0001/0020: Pendencia Paga (5) e Rejeitado/Estorno (4) nunca vem desta fonte, que
    // filtra por data de VENCIMENTO - as duas tem data/regra propria (pendencia_paga*,
    // pendencia_pagamento abaixo), filtradas por data de PAGAMENTO.
    const isSingleDate = dateOnly(filter.dataInicio) === dateOnly(filter.dataFim);
    // valorMin/valorMax valem sobre o total do periodo, como no Consolidado: por consorcio quando
    // ha filtro de consorcio, senao por favorecido. A janela roda antes do cursor, entao o total
    // nao muda entre paginas.
    const temFiltroConsorcio = perfil === 'permissionario' && (Boolean(filter.consorcioNome?.length) || Boolean(filter.todosConsorcios));
    const chaveDoTotal = temFiltroConsorcio ? '"nomeConsorcio"' : 'nomes';

    const sql = `
      WITH ${ASSOCIACAO_CTE[perfil]} agrupada AS (
        -- Ordens ja agrupadas com detalhe_a (Pago / A Pagar enviado / Aguardando Pagamento, via
        -- resolver de status compartilhado). Dedupe de fan-out (ADR 0011): uma linha
        -- representativa por agrupamento (LATERAL), nunca uma por ordem filha.
        SELECT
          da."dataVencimento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          ${statusCase} AS status,
          da.id AS "detalheAId"
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        ${lateral}
        WHERE da."dataVencimento"::date BETWEEN $1::date AND $2::date
          AND oph."statusRemessa" NOT IN (4, 5)
          ${filtroFavorecido}
      ),
      pendencia_paga AS (
        -- Pendencia Paga (status 5, ADR 0001): sem gate de dia unico - sempre pela data de
        -- pagamento do pai quando existe (familia), senao a propria. Uma linha por filha (nao
        -- soma lotes diferentes entre si, ao contrario de agrupada_somada).
        SELECT
          (CASE WHEN opa."ordemPagamentoAgrupadoId" IS NOT NULL THEN op_pai."dataPagamento" ELSE opa."dataPagamento" END)::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          '${StatusPagamento.PENDENCIA_PAGA}' AS status,
          'pendencia_paga:' || da.id::text AS "chaveLinha"
        FROM ordem_pagamento_agrupado opa
        LEFT JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        ${lateral}
        WHERE oph."statusRemessa" = 5
          AND ${AGRUPAMENTO_SEM_FILHAS('opa')}
          AND (
            (opa."ordemPagamentoAgrupadoId" IS NOT NULL AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date)
            OR (opa."ordemPagamentoAgrupadoId" IS NULL AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date)
          )
          AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
          AND da.id = (
            -- Uma filha paga guarda detalhe_a de todas as tentativas antigas - mantem uma so
            -- linha: a de mesmo valor do valorTotal da filha, senao a mais recente.
            SELECT da_filha.id
            FROM ordem_pagamento_agrupado_historico oph_filha
            INNER JOIN detalhe_a da_filha ON da_filha."ordemPagamentoAgrupadoHistoricoId" = oph_filha.id
            WHERE oph_filha."ordemPagamentoAgrupadoId" = opa.id AND oph_filha."statusRemessa" = 5
            ORDER BY (ROUND(da_filha."valorLancamento"::numeric, 2) = ROUND(opa."valorTotal"::numeric, 2)) DESC, da_filha.id DESC
            LIMIT 1
          )
          ${filtroFavorecido}
      ),
      pendencia_paga_passo0 AS (
        -- PASSO 0: filha paga nunca enviada em arquivo proprio (nenhum historico dela tem
        -- detalhe_a) - valor = valorTotal da propria opa filha, data = pagamento do pai.
        SELECT
          op_pai."dataPagamento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          ROUND(opa."valorTotal"::numeric, 2) AS valor,
          '${StatusPagamento.PENDENCIA_PAGA}' AS status,
          'pendencia_paga_passo0:' || opa.id::text AS "chaveLinha"
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph.id = (
          SELECT MAX(oph_mais_recente.id) FROM ordem_pagamento_agrupado_historico oph_mais_recente WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = opa.id
        )
        ${lateral}
        WHERE ${AGRUPAMENTO_SEM_FILHAS('opa')}
          AND oph."statusRemessa" = 5
          AND op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
          AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
          AND NOT EXISTS (
            SELECT 1
            FROM ordem_pagamento_agrupado_historico oph_qualquer
            INNER JOIN detalhe_a da_qualquer ON da_qualquer."ordemPagamentoAgrupadoHistoricoId" = oph_qualquer.id
            WHERE oph_qualquer."ordemPagamentoAgrupadoId" = opa.id
          )
          ${filtroFavorecido}
      ),
      pendencia_pagamento AS (
        ${isSingleDate ? this.buildPendenciaPagamentoDiaUnicoSql(perfil, lateral, filtroFavorecido) : this.buildPendenciaPagamentoIntervaloSql(perfil, lateral, filtroFavorecido)}
      ),
      pendentes AS (
        ${this.buildPendentesSql(perfil, lateral, filtroFavorecido)}
      ),
      agrupada_somada AS (
        -- Soma lotes distintos (agrupamentos diferentes) do mesmo favorecido/dia/status - unico
        -- nivel de agregacao desta fonte. Nao se mistura com a fonte "nunca enviada" abaixo: cada
        -- fonte agrega (ou nao) dentro de si mesma, nunca as duas juntas. nomeConsorcio entra no
        -- GROUP BY mas e deterministico por favorecido/ordem (nao fragmenta totais reais).
        SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", SUM(valor) AS valor, status,
          'agrupada:' || MIN("detalheAId")::text AS "chaveLinha"
        FROM agrupada
        GROUP BY "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", status
      ),
      nunca_enviada AS (
        -- Ordens nunca agrupadas/enviadas (ADR 0017): sem valorLancamento de lote a somar, cada
        -- ordem permanece sua propria linha - nao ha agregacao nesta fonte.
        SELECT
          op."${dataCapturaColumn}"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_NUNCA_ENVIADA[perfil]} AS "nomeConsorcio",
          op."${valorColumn}" AS valor,
          '${StatusPagamento.A_PAGAR}' AS status,
          -- oph.id entra na chave: uma ordem de agrupamento sem detalhe_a sai uma vez por historico.
          'nunca_enviada:' || op.id::text || ':' || COALESCE(oph.id::text, '0') AS "chaveLinha"
        FROM ${ordemTable} op
        LEFT JOIN ordem_pagamento_agrupado opa ON op."ordemPagamentoAgrupadoId" = opa.id
        LEFT JOIN public."user" pu ON pu.id = op."userId"
        ${ASSOCIACAO_JOIN[perfil]}
        LEFT JOIN ordem_pagamento_agrupado_historico oph ON opa.id = oph."ordemPagamentoAgrupadoId"
        LEFT JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        WHERE (
            (op."ordemPagamentoAgrupadoId" IS NULL AND NOT ${resolveCondicaoPendenteOrdemSolta(perfil)})
            OR (op."ordemPagamentoAgrupadoId" IS NOT NULL AND da.id IS NULL)
          )
          AND op."${dataCapturaColumn}"::date BETWEEN $1::date AND $2::date
          ${filtroFavorecido}
      ),
      combinado AS (
        SELECT * FROM agrupada_somada
        UNION ALL
        SELECT * FROM nunca_enviada
        UNION ALL
        SELECT * FROM pendencia_paga
        UNION ALL
        SELECT * FROM pendencia_paga_passo0
        UNION ALL
        SELECT * FROM pendencia_pagamento
        UNION ALL
        SELECT * FROM pendentes
      ),
      filtrado AS (
        SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", valor, status, "chaveLinha",
          SUM(valor) OVER (PARTITION BY ${chaveDoTotal}) AS "totalDoGrupo"
        FROM combinado
        WHERE ($3::text[] IS NULL OR status = ANY($3))
          AND ($7::text[] IS NULL OR UPPER(TRIM("nomeConsorcio")) = ANY($7))
          AND ($8::text[] IS NULL OR NOT ("cpfCnpj" = ANY($8)))
      )
      SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", valor, status, "chaveLinha"
      FROM filtrado
      WHERE ($4::numeric IS NULL OR "totalDoGrupo" >= $4)
        AND ($5::numeric IS NULL OR "totalDoGrupo" <= $5)
    `;

    return {
      sql,
      params: [
        filter.dataInicio,
        filter.dataFim,
        filter.statuses?.length ? filter.statuses : null,
        filter.valorMin ?? null,
        filter.valorMax ?? null,
        filter.userIds?.length ? filter.userIds : null,
        nomeConsorcioList,
        excludeInstitutional ? [...INSTITUTIONAL_CPF_CNPJ] : null,
        ...paramsAssociacao,
      ],
    };
  }

  // Eleição (T7, Permissionário apenas - AC-11): pagamento unico, pagador CETT. Le de
  // ordem_pagamento_unico em vez das fontes compartilhadas acima (agrupada/nunca_enviada/
  // pendencia_*) - nem o caminho de join do favorecido (permitCode/idOperadora, com fallback
  // por cpfCnpj apenas quando nao ha usuario com aquele permitCode, ADR 0019) nem o conjunto de
  // status disponivel (buildEleicaoStatusPagamentoCaseSql, restrito por ADR 0004 - sem
  // Pendencia Paga/Pendentes) coincidem com o resto de findGroupedRows. Por isso e' um metodo
  // separado, nao uma nova fonte na CTE "combinado" (decisao documentada no relatorio da task).
  async findEleicaoRows(filter: Pick<BasePagamentoFilter, 'dataInicio' | 'dataFim' | 'statuses' | 'valorMin' | 'valorMax' | 'consorcioNome' | 'todosConsorcios' | 'desativados'>): Promise<BasePagamentoRow[]> {
    const eleicaoStatusCase = buildEleicaoStatusPagamentoCaseSql('oph');
    const chaveDoTotal = filter.consorcioNome?.length || filter.todosConsorcios ? '"nomeConsorcio"' : 'nomes';

    const sql = `
      WITH eleicao AS (
        SELECT
          da."dataVencimento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          opu."consorcio" AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          ${eleicaoStatusCase} AS status
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        INNER JOIN ordem_pagamento_unico opu ON opu."idOrdemPagamento" = opa.id::varchar
        -- permitCode/idOperadora e' a ligacao principal, nunca cpfCnpj diretamente: "user".
        -- "cpfCnpj" nao e' unico (achado contra stag, 19/10/2026) - ligar por ele faria
        -- fan-out, dobrando o valor da mesma ordem. Fallback por operadoraCpfCnpj (ADR 0019)
        -- so' quando NAO EXISTE nenhum usuario com esse permitCode (ordens antigas, ex.
        -- nov/2024, com idOperadora NULL) - verificado que essa populacao nao tem CPF
        -- duplicado, entao o fallback nao reintroduz o fan-out que motivou a troca para
        -- permitCode.
        INNER JOIN LATERAL (
          SELECT u.* FROM public."user" u WHERE u."permitCode" = opu."idOperadora"
          UNION ALL
          SELECT u.* FROM public."user" u
          WHERE NOT EXISTS (
            SELECT 1 FROM public."user" u2 WHERE u2."permitCode" = opu."idOperadora"
          )
          AND u."cpfCnpj" = opu."operadoraCpfCnpj"
        ) pu ON true
        WHERE da."dataVencimento"::date BETWEEN $1::date AND $2::date
          ${condicaoBloqueado(filter)}
      )
      , filtrado AS (
        SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", valor, status,
          SUM(valor) OVER (PARTITION BY ${chaveDoTotal}) AS "totalDoGrupo"
        FROM eleicao
        WHERE ($3::text[] IS NULL OR status = ANY($3))
      )
      SELECT "dataReferencia", nomes, "cpfCnpj", "nomeConsorcio", valor, status
      FROM filtrado
      WHERE ($4::numeric IS NULL OR "totalDoGrupo" >= $4)
        AND ($5::numeric IS NULL OR "totalDoGrupo" <= $5)
      ORDER BY "dataReferencia", nomes
    `;

    return this.dataSource.query(sql, [
      filter.dataInicio,
      filter.dataFim,
      filter.statuses?.length ? filter.statuses : null,
      filter.valorMin ?? null,
      filter.valorMax ?? null,
    ]);
  }

  // Dia unico (ADR 0008/nota do ADR 0001): a familia pai define status (historico mais recente
  // do pai) e data de referencia; o valor e' da propria filha. Sem filtro de elegibilidade (ADR
  // 0020) - esta consulta dedicada nunca teve esse filtro no legado, so o caminho de intervalo.
  private buildPendenciaPagamentoDiaUnicoSql(perfil: Perfil, lateral: string, filtroFavorecido: string): string {
    const statusPai = buildStatusPagamentoCaseSql('oph_pai');
    const statusPropria = buildStatusPagamentoCaseSql('oph');
    const statusRejeitado = `'${StatusPagamento.ERRO_ESTORNO}', '${StatusPagamento.ERRO_REJEITADO}'`;
    return `
        SELECT
          op_pai."dataPagamento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          ${statusPai} AS status,
          'pendencia_pagamento_familia:' || da.id::text AS "chaveLinha"
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado op_pai ON op_pai.id = opa."ordemPagamentoAgrupadoId"
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        INNER JOIN ordem_pagamento_agrupado_historico oph_pai ON oph_pai.id = (
          SELECT MAX(oph_mais_recente.id) FROM ordem_pagamento_agrupado_historico oph_mais_recente WHERE oph_mais_recente."ordemPagamentoAgrupadoId" = op_pai.id
        )
        ${lateral}
        WHERE op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date
          AND ${statusPai} IN (${statusRejeitado})
          AND (oph_pai."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph_pai."motivoStatusRemessa" IS NULL)
          ${filtroFavorecido}

        UNION ALL

        -- Sem pai (ADR 0008): nunca foi filha - usa a propria data/status do registro.
        SELECT
          opa."dataPagamento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          ${statusPropria} AS status,
          'pendencia_pagamento_propria:' || da.id::text AS "chaveLinha"
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        ${lateral}
        WHERE opa."ordemPagamentoAgrupadoId" IS NULL
          AND opa."dataPagamento"::date BETWEEN $1::date AND $2::date
          AND ${statusPropria} IN (${statusRejeitado})
          AND (oph."motivoStatusRemessa" NOT IN ('AM', 'AE') OR oph."motivoStatusRemessa" IS NULL)
          ${filtroFavorecido}
    `;
  }

  // Intervalo maior que um dia: orientado pela propria filha (data de vencimento), com o
  // filtro de elegibilidade do ADR 0020 - so mostra o que ainda seria pago de novo, mesma regra
  // da procedure real (reusada de regras-pendencia.ts, nunca reescrita).
  private buildPendenciaPagamentoIntervaloSql(perfil: Perfil, lateral: string, filtroFavorecido: string): string {
    const statusPropria = buildStatusPagamentoCaseSql('oph');
    return `
        SELECT
          da."dataVencimento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          ${statusPropria} AS status,
          'pendencia_pagamento_intervalo:' || da.id::text AS "chaveLinha"
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        ${lateral}
        WHERE da."dataVencimento"::date BETWEEN $1::date AND $2::date
          AND ${AGRUPAMENTO_SEM_FILHAS('opa')}
          AND ${resolveElegibilidadeRejeitado(perfil)}
          ${filtroFavorecido}
    `;
  }

  // T6 (ADR 0021/AC-18): "Pendentes" (OPs atrasadas) - exatamente a elegibilidade que a
  // geracao real de remessa usa pra decidir o que reprocessar (regras-pendencia.ts, nunca
  // reescrita): ordem solta capturada ha mais de 10 dias (PASSO 0), rejeicao real do banco que
  // ainda seria paga de novo (PASSO 1, mesma condicao reusada pelo bucket Rejeitado/Estorno em
  // resolveElegibilidadeRejeitado) e, so' para Guardador, agrupamento criado e nunca enviado
  // (PASSO 1, 3o ramo - nao existe funcao equivalente em regras-pendencia.ts para
  // Permissionario; achado a reportar, nao uma lacuna desta task).
  private buildPendentesSql(perfil: Perfil, lateral: string, filtroFavorecido: string): string {
    const ordemTable = ORDEM_TABLE[perfil];
    const dataCapturaColumn = DATA_CAPTURA_COLUMN[perfil];
    const valorColumn = VALOR_COLUMN[perfil];
    const nuncaEnviadoGuardador = perfil === 'guardador'
      ? `
        UNION ALL

        SELECT
          opa."dataPagamento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          opa."valorTotal" AS valor,
          '${StatusPagamento.PENDENTES}' AS status,
          'pendentes_nunca_enviado:' || opa.id::text AS "chaveLinha"
        FROM ordem_pagamento_agrupado opa
        ${lateral}
        WHERE opa."dataPagamento"::date BETWEEN $1::date AND $2::date
          AND ${pendenciaAgrupamentoNuncaEnviadoGuardador('opa', 'pu')}
          ${filtroFavorecido}
      `
      : '';

    return `
        SELECT
          op."${dataCapturaColumn}"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_NUNCA_ENVIADA[perfil]} AS "nomeConsorcio",
          op."${valorColumn}" AS valor,
          '${StatusPagamento.PENDENTES}' AS status,
          'pendentes_solta:' || op.id::text AS "chaveLinha"
        FROM ${ordemTable} op
        LEFT JOIN public."user" pu ON pu.id = op."userId"
        ${ASSOCIACAO_JOIN[perfil]}
        WHERE op."${dataCapturaColumn}"::date BETWEEN $1::date AND $2::date
          AND op."ordemPagamentoAgrupadoId" IS NULL
          ${resolveElegibilidadePendenteOrdemSolta(perfil)}
          ${filtroFavorecido}

        UNION ALL

        SELECT
          da."dataVencimento"::date AS "dataReferencia",
          pu."fullName" AS nomes,
          pu."cpfCnpj" AS "cpfCnpj",
          ${NOME_CONSORCIO_AGRUPADA[perfil]} AS "nomeConsorcio",
          da."valorLancamento" AS valor,
          '${StatusPagamento.PENDENTES}' AS status,
          'pendentes_rejeitado:' || da.id::text AS "chaveLinha"
        FROM ordem_pagamento_agrupado opa
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
        INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        ${lateral}
        WHERE da."dataVencimento"::date BETWEEN $1::date AND $2::date
          AND ${AGRUPAMENTO_SEM_FILHAS('opa')}
          AND ${resolveElegibilidadeRejeitado(perfil)}
          ${filtroFavorecido}
        ${nuncaEnviadoGuardador}
    `;
  }
}

function dateOnly(value: Date): string {
  return new Date(value).toISOString().slice(0, 10);
}
