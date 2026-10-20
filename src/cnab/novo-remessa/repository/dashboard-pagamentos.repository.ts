import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ContaDashboard,
  LinhaResumo,
  PAGADOR_ID_POR_CONTA,
  SituacaoDashboard,
  sqlNormalizarGrupo,
} from '../service/dashboard-pagamentos.utils';

export interface FiltroPeriodo {
  dataInicio: string; // YYYY-MM-DD (inclusive)
  dataFim: string; // YYYY-MM-DD (inclusive)
}

export interface FiltroDetalhe extends FiltroPeriodo {
  conta: ContaDashboard;
  grupo?: string;
  situacao?: SituacaoDashboard;
  motivo?: string;
  /** Nome (parte) ou CPF/CNPJ (parte, só dígitos) do favorecido. */
  busca?: string;
  page: number;
  pageSize: number;
}

export interface LinhaDetalhe {
  detalheAId: number;
  agrupadoId: number;
  remessaId: number | null;
  data: string;
  grupo: string;
  situacao: SituacaoDashboard;
  motivo: string | null;
  valor: string;
  favorecidoId: number | null;
  favorecido: string | null;
  cpfCnpj: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
}

/** Filtros da exportação: os mesmos do detalhe, sem paginação. */
export type FiltroExportacao = Omit<FiltroDetalhe, 'page' | 'pageSize'>;

/** Uma linha da exportação: uma ordem de pagamento que compõe um pagamento (detalhe_a). */
export interface LinhaExportacao {
  detalheAId: number;
  nome: string | null;
  cpf: string | null;
  /** YYYY-MM-DD; nulo quando o pagamento não tem ordens ligadas. */
  dataOrdem: string | null;
  valorOrdem: string | null;
  valorLancamento: string;
}

/**
 * Consultas do dashboard de pagamentos. Um "pagamento" é uma linha de `detalhe_a` (uma instrução
 * enviada ao banco) com vencimento no período. A situação vem do histórico do agrupado:
 * 3 e 5 = pago, 4 = não pago (motivo = ocorrência do banco), 0/1/2 = em aberto.
 *
 * O grupo (consórcio/modal) é resolvido por consultas em lote (CTEs) e não por subconsulta por
 * linha, porque `ordem_pagamento` tem ~1 milhão de linhas.
 */
@Injectable()
export class DashboardPagamentosRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** CTEs até `classificado`: cada pagamento do período com conta, grupo, situação e motivo. */
  private cteClassificado(indiceBusca?: number): string {
    const grupoBilhetagem = sqlNormalizarGrupo('gb.nome');
    const grupoCett = sqlNormalizarGrupo('gg.nome');
    // Com busca por favorecido, só os agrupados dos usuários encontrados entram em `base`; assim as
    // demais CTEs (grupo, pagamento único) também trabalham só nesse subconjunto.
    const prefixoBusca = indiceBusca ? `${this.cteBusca(indiceBusca)},` : '';
    const filtroBusca = indiceBusca ? 'AND opa.id IN (SELECT id FROM agrupados_busca)' : '';
    return `${prefixoBusca}
      base AS (
        SELECT da.id AS detalhe_a_id,
               da."valorLancamento"::numeric AS valor,
               da."dataVencimento"::date AS data,
               opa."pagadorId" AS pagador_id,
               opa.id AS agrupado_id,
               oph."statusRemessa" AS status,
               NULLIF(TRIM(oph."motivoStatusRemessa"), '') AS motivo_codigo,
               hl."headerArquivoId" AS remessa_id,
               oph."userBankCode" AS banco,
               oph."userBankAgency" AS agencia,
               oph."userBankAccount" || '-' || oph."userBankAccountDigit" AS conta_bancaria
        FROM detalhe_a da
        JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
        JOIN ordem_pagamento_agrupado opa ON opa.id = oph."ordemPagamentoAgrupadoId"
        LEFT JOIN header_lote hl ON hl.id = da."headerLoteId"
        WHERE da."dataVencimento" >= $1::date
          AND da."dataVencimento" < ($2::date + 1)
          AND opa."pagadorId" = ANY($3::int[])
          ${filtroBusca}
      ),
      alvos AS (
        SELECT b.agrupado_id AS pai, b.agrupado_id AS alvo FROM base b WHERE b.pagador_id = ${PAGADOR_ID_POR_CONTA.bilhetagem}
        UNION
        SELECT f."ordemPagamentoAgrupadoId", f.id
        FROM ordem_pagamento_agrupado f
        WHERE f."ordemPagamentoAgrupadoId" IN (SELECT agrupado_id FROM base WHERE pagador_id = ${PAGADOR_ID_POR_CONTA.bilhetagem})
      ),
      grupo_bilhetagem AS (
        SELECT DISTINCT ON (a.pai) a.pai AS agrupado_id, op."nomeConsorcio" AS nome
        FROM alvos a
        JOIN ordem_pagamento op ON op."ordemPagamentoAgrupadoId" = a.alvo
        GROUP BY a.pai, op."nomeConsorcio"
        ORDER BY a.pai, count(*) DESC
      ),
      grupo_gratuidade AS (
        SELECT DISTINCT ON (op."ordemPagamentoAgrupadoGratuidadeId") op."ordemPagamentoAgrupadoGratuidadeId" AS agrupado_id, op."nomeConsorcio" AS nome
        FROM ordem_pagamento op
        WHERE op."ordemPagamentoAgrupadoGratuidadeId" IN (SELECT agrupado_id FROM base WHERE pagador_id = ${PAGADOR_ID_POR_CONTA.cett})
        GROUP BY op."ordemPagamentoAgrupadoGratuidadeId", op."nomeConsorcio"
        ORDER BY op."ordemPagamentoAgrupadoGratuidadeId", count(*) DESC
      ),
      pagamento_unico AS (
        SELECT DISTINCT u."idOrdemPagamento" AS agrupado_id
        FROM ordem_pagamento_unico u
        WHERE u."idOrdemPagamento" IN (SELECT agrupado_id::text FROM base WHERE pagador_id = ${PAGADOR_ID_POR_CONTA.cett})
      ),
      classificado AS (
        SELECT b.*,
               CASE b.pagador_id
                 WHEN ${PAGADOR_ID_POR_CONTA.bilhetagem} THEN 'bilhetagem'
                 WHEN ${PAGADOR_ID_POR_CONTA.rotativo} THEN 'rotativo'
                 WHEN ${PAGADOR_ID_POR_CONTA.cett} THEN 'cett'
               END AS conta,
               CASE WHEN b.status IN (3, 5) THEN 'pago' WHEN b.status = 4 THEN 'naoPago' ELSE 'emAberto' END AS situacao,
               CASE
                 WHEN b.status = 4 THEN COALESCE(b.motivo_codigo, 'SEM_MOTIVO')
                 WHEN b.status = 5 THEN 'PENDENCIA_PAGA'
                 WHEN b.status = 3 THEN 'EFETIVADO'
                 WHEN b.status = 2 THEN 'AGUARDANDO_PAGAMENTO'
                 WHEN b.status = 1 THEN 'ENVIADO'
                 ELSE 'CRIADO'
               END AS motivo,
               CASE b.pagador_id
                 WHEN ${PAGADOR_ID_POR_CONTA.rotativo} THEN 'Guardador'
                 WHEN ${PAGADOR_ID_POR_CONTA.bilhetagem} THEN ${grupoBilhetagem}
                 WHEN ${PAGADOR_ID_POR_CONTA.cett} THEN
                   CASE
                     WHEN gg.nome IS NOT NULL THEN ${grupoCett}
                     WHEN pu.agrupado_id IS NOT NULL THEN 'Pagamento único'
                     ELSE 'Outros'
                   END
               END AS grupo
        FROM base b
        LEFT JOIN grupo_bilhetagem gb ON gb.agrupado_id = b.agrupado_id AND b.pagador_id = ${PAGADOR_ID_POR_CONTA.bilhetagem}
        LEFT JOIN grupo_gratuidade gg ON gg.agrupado_id = b.agrupado_id AND b.pagador_id = ${PAGADOR_ID_POR_CONTA.cett}
        LEFT JOIN pagamento_unico pu ON pu.agrupado_id = b.agrupado_id::text AND b.pagador_id = ${PAGADOR_ID_POR_CONTA.cett}
      )`;
  }

  /**
   * Agrupados dos favorecidos que batem com a busca (por nome ou CPF/CNPJ). Parte dos usuários
   * encontrados e segue os vínculos já indexados (userId das ordens), em vez de resolver o favorecido
   * de todos os pagamentos do período.
   */
  private cteBusca(indice: number): string {
    const texto = `$${indice}::text`;
    const digitos = `regexp_replace(${texto}, '\\D', '', 'g')`;
    const usuarios = `SELECT id FROM usuarios_busca`;
    return `
      usuarios_busca AS (
        SELECT u.id, regexp_replace(u."cpfCnpj", '\\D', '', 'g') AS cpf
        FROM "user" u
        WHERE position(lower(${texto}) IN lower(u."fullName")) > 0
           OR (length(${digitos}) >= 3 AND position(${digitos} IN regexp_replace(u."cpfCnpj", '\\D', '', 'g')) > 0)
      ),
      agrupados_busca AS (
        SELECT op."ordemPagamentoAgrupadoId" AS id FROM ordem_pagamento op
        WHERE op."userId" IN (${usuarios}) AND op."ordemPagamentoAgrupadoId" IS NOT NULL
        UNION
        SELECT f."ordemPagamentoAgrupadoId" FROM ordem_pagamento_agrupado f
        WHERE f."ordemPagamentoAgrupadoId" IS NOT NULL
          AND f.id IN (SELECT op."ordemPagamentoAgrupadoId" FROM ordem_pagamento op WHERE op."userId" IN (${usuarios}))
        UNION
        SELECT g."ordemPagamentoAgrupadoId" FROM ordem_pagamento_guardador g
        WHERE g."userId" IN (${usuarios}) AND g."ordemPagamentoAgrupadoId" IS NOT NULL
        UNION
        SELECT op."ordemPagamentoAgrupadoGratuidadeId" FROM ordem_pagamento op
        WHERE op."userId" IN (${usuarios}) AND op."ordemPagamentoAgrupadoGratuidadeId" IS NOT NULL
        UNION
        SELECT x."idOrdemPagamento"::int FROM ordem_pagamento_unico x
        WHERE x."idOrdemPagamento" ~ '^[0-9]+$'
          AND regexp_replace(x."operadoraCpfCnpj", '\\D', '', 'g') IN (SELECT cpf FROM usuarios_busca)
      )`;
  }

  private params(periodo: FiltroPeriodo, contas: ContaDashboard[]): [string, string, number[]] {
    return [periodo.dataInicio, periodo.dataFim, contas.map((c) => PAGADOR_ID_POR_CONTA[c])];
  }

  async resumo(periodo: FiltroPeriodo): Promise<LinhaResumo[]> {
    const sql = `
      WITH ${this.cteClassificado()}
      SELECT conta, COALESCE(grupo, 'Outros') AS grupo, situacao, motivo,
             count(*)::int AS qtd, COALESCE(sum(valor), 0)::numeric(18,2) AS valor
      FROM classificado
      GROUP BY conta, COALESCE(grupo, 'Outros'), situacao, motivo`;
    return this.dataSource.query(sql, this.params(periodo, ['bilhetagem', 'rotativo', 'cett']));
  }

  async detalhe(filtro: FiltroDetalhe): Promise<{ total: number; valorTotal: number; itens: LinhaDetalhe[] }> {
    const params: unknown[] = [...this.params(filtro, [filtro.conta])];
    const condicoes: string[] = [];
    const adicionar = (coluna: string, valor: string | undefined) => {
      if (valor === undefined || valor === '') return;
      params.push(valor);
      condicoes.push(`${coluna} = $${params.length}`);
    };
    adicionar('situacao', filtro.situacao);
    adicionar('motivo', filtro.motivo);
    adicionar('COALESCE(grupo, \'Outros\')', filtro.grupo);

    // Busca por favorecido (nome ou CPF/CNPJ): restringe a origem dos pagamentos, ver cteClassificado.
    const busca = filtro.busca?.trim();
    let indiceBusca: number | undefined;
    if (busca) {
      params.push(busca);
      indiceBusca = params.length;
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    const totais = await this.dataSource.query(
      `WITH ${this.cteClassificado(indiceBusca)}
       SELECT count(*)::int AS total, COALESCE(sum(valor), 0)::numeric(18,2) AS valor_total FROM classificado ${where}`,
      params,
    );

    const limit = filtro.pageSize;
    const offset = (filtro.page - 1) * filtro.pageSize;
    const itens: LinhaDetalhe[] = await this.dataSource.query(
      `WITH ${this.cteClassificado(indiceBusca)},
       pagina AS (
         SELECT * FROM classificado ${where}
         ORDER BY data DESC, detalhe_a_id DESC
         LIMIT ${limit} OFFSET ${offset}
       )
       SELECT p.detalhe_a_id AS "detalheAId", p.agrupado_id AS "agrupadoId", p.remessa_id AS "remessaId",
              to_char(p.data, 'YYYY-MM-DD') AS data, COALESCE(p.grupo, 'Outros') AS grupo, p.situacao, p.motivo, p.valor::text AS valor,
              u.id AS "favorecidoId", u."fullName" AS favorecido, u."cpfCnpj" AS "cpfCnpj",
              p.banco, p.agencia, p.conta_bancaria AS conta
       FROM pagina p
       ${this.joinFavorecido()}
       ORDER BY p.data DESC, p.detalhe_a_id DESC`,
      params,
    );

    return { total: totais[0]?.total ?? 0, valorTotal: Number(totais[0]?.valor_total ?? 0), itens };
  }

  /** `LEFT JOIN "user" u` do favorecido de um pagamento `p` (resolvido pelas ordens ligadas ao agrupado). */
  private joinFavorecido(): string {
    return `LEFT JOIN "user" u ON u.id = (
         CASE p.pagador_id
           WHEN ${PAGADOR_ID_POR_CONTA.bilhetagem} THEN (
             SELECT op."userId" FROM ordem_pagamento op WHERE op."ordemPagamentoAgrupadoId" = p.agrupado_id AND op."userId" IS NOT NULL LIMIT 1)
           WHEN ${PAGADOR_ID_POR_CONTA.rotativo} THEN (
             SELECT g."userId" FROM ordem_pagamento_guardador g WHERE g."ordemPagamentoAgrupadoId" = p.agrupado_id LIMIT 1)
           WHEN ${PAGADOR_ID_POR_CONTA.cett} THEN COALESCE(
             (SELECT op."userId" FROM ordem_pagamento op WHERE op."ordemPagamentoAgrupadoGratuidadeId" = p.agrupado_id AND op."userId" IS NOT NULL LIMIT 1),
             (SELECT u2.id FROM "user" u2 WHERE u2."cpfCnpj" = (SELECT x."operadoraCpfCnpj" FROM ordem_pagamento_unico x WHERE x."idOrdemPagamento" = p.agrupado_id::text LIMIT 1) LIMIT 1))
         END)`;
  }

  /**
   * Todas as ordens que compõem os pagamentos do filtro (sem paginação), uma linha por ordem, ordenadas por
   * nome e data da ordem. Gratuidade (CETT): `valorGratuidade` por dia; bilhetagem: valor da ordem; rotativo:
   * repasse do guardador. Pagamento sem ordens ligadas gera uma linha com a ordem vazia.
   * Devolve até `limite + 1` linhas, para quem chama saber que passou do limite.
   */
  async exportar(filtro: FiltroExportacao, limite: number): Promise<LinhaExportacao[]> {
    const params: unknown[] = [...this.params(filtro, [filtro.conta])];
    const condicoes: string[] = [];
    const adicionar = (coluna: string, valor: string | undefined) => {
      if (valor === undefined || valor === '') return;
      params.push(valor);
      condicoes.push(`${coluna} = $${params.length}`);
    };
    adicionar('situacao', filtro.situacao);
    adicionar('motivo', filtro.motivo);
    adicionar('COALESCE(grupo, \'Outros\')', filtro.grupo);

    const busca = filtro.busca?.trim();
    let indiceBusca: number | undefined;
    if (busca) {
      params.push(busca);
      indiceBusca = params.length;
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const { bilhetagem, rotativo, cett } = PAGADOR_ID_POR_CONTA;

    return this.dataSource.query(
      `WITH ${this.cteClassificado(indiceBusca)},
       alvo AS (SELECT * FROM classificado ${where})
       SELECT p.detalhe_a_id AS "detalheAId", u."fullName" AS nome, u."cpfCnpj" AS cpf,
              to_char(o.data_ordem, 'YYYY-MM-DD') AS "dataOrdem", o.valor_ordem::text AS "valorOrdem",
              p.valor::text AS "valorLancamento"
       FROM alvo p
       ${this.joinFavorecido()}
       LEFT JOIN LATERAL (
         SELECT op."dataOrdem"::date AS data_ordem, op."valor" AS valor_ordem
           FROM ordem_pagamento op
          WHERE p.pagador_id = ${bilhetagem}
            AND (op."ordemPagamentoAgrupadoId" = p.agrupado_id
                 OR op."ordemPagamentoAgrupadoId" IN (
                      SELECT f.id FROM ordem_pagamento_agrupado f WHERE f."ordemPagamentoAgrupadoId" = p.agrupado_id))
         UNION ALL
         SELECT g."dataOrdem"::date, g."valorRepasseGuardador"
           FROM ordem_pagamento_guardador g
          WHERE p.pagador_id = ${rotativo} AND g."ordemPagamentoAgrupadoId" = p.agrupado_id
         UNION ALL
         SELECT op."dataOrdem"::date, op."valorGratuidade"
           FROM ordem_pagamento op
          WHERE p.pagador_id = ${cett} AND op."ordemPagamentoAgrupadoGratuidadeId" = p.agrupado_id
         UNION ALL
         SELECT NULLIF(x."dataOrdem", '')::date, x."valorTotalTransacaoLiquido"
           FROM ordem_pagamento_unico x
          WHERE p.pagador_id = ${cett} AND x."idOrdemPagamento" = p.agrupado_id::text
       ) o ON true
       ORDER BY u."fullName" NULLS LAST, u."cpfCnpj", p.detalhe_a_id, o.data_ordem
       LIMIT ${limite + 1}`,
      params,
    );
  }
}
