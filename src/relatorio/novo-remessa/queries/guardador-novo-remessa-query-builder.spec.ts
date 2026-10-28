import {
  buildGuardadorAPagarQuery,
  buildGuardadorBaseQuery,
  buildGuardadorPendenciaPagamentoSingleDateQuery,
  buildGuardadorPendenciaPagaSingleDateQuery,
} from './guardador-novo-remessa-query-builder';

const builders = {
  base: buildGuardadorBaseQuery,
  aPagar: buildGuardadorAPagarQuery,
  pendenciaPagaSingleDate: buildGuardadorPendenciaPagaSingleDateQuery,
};

describe('guardador-novo-remessa-query-builder', () => {
  describe.each(Object.entries(builders))('%s query', (name, build) => {
    // A guardador linked to more than one association must yield one row per
    // payment; a plain LEFT JOIN on user_relationships yields one per association.
    it('does not multiply rows through a plain user_relationships join', () => {
      const sql = build();

      expect(sql).not.toMatch(/LEFT JOIN\s+user_relationships/i);
      expect(sql).not.toMatch(/LEFT JOIN\s+public\."user"\s+assoc/i);
    });

    // A guardador can belong to several associations. They are aggregated once per user
    // (GROUP BY user_id) in a MATERIALIZED CTE, so it is computed once whatever plan the
    // planner picks, and joined on that key: one row per payment, no repeated value.
    it('aggregates every association of a guardador once per user in a materialized CTE', () => {
      const sql = build();

      expect(sql).toMatch(/WITH assoc AS MATERIALIZED/i);
      expect(sql).toMatch(/STRING_AGG\(/i);
      expect(sql).toMatch(/GROUP BY ur\.user_id/i);
      expect(sql).toMatch(/LEFT JOIN assoc\s+ON assoc\.user_id = pu\.id/i);
    });

    // The builders are used inside UNION ALL and CTEs, so each one is a parenthesized select.
    it('returns a parenthesized select so it can be used in a UNION ALL', () => {
      const sql = build();

      expect(sql.startsWith('(WITH assoc AS MATERIALIZED')).toBe(true);
      expect(sql.endsWith(')')).toBe(true);
    });

    // The join must not be correlated: a per-row LATERAL scans user_relationships once per payment.
    it('does not use a correlated LATERAL join for the associations', () => {
      expect(build()).not.toMatch(/LATERAL/i);
    });

    it('shows all the associations joined by a separator', () => {
      expect(build()).toContain("' / '");
    });

    // Associations (SINGAERJ, ANGLAE) are payees in ordem_pagamento_guardador too, but
    // selecting a consorcio must show the guardadores linked to it (array overlap against
    // every association each guardador belongs to), never the association's own payment.
    it('matches the consorcio filter against the associations of each guardador, not the association itself', () => {
      const sql = build({ consorcioFilterParamIndex: 5 });

      expect(sql).toContain('assoc."nomesUpper" && $5::text[]');
      expect(sql).not.toContain('UPPER(TRIM(pu."fullName")) = ANY($5::text[])');
    });

    // "Todas as Associações" must show every guardador linked to at least one association,
    // regardless of which names $5 would hold, and never the association's own payment.
    it('matches every guardador with at least one association when todosConsorcios is set', () => {
      const sql = build({ consorcioFilterParamIndex: 5, todosConsorcios: true });

      expect(sql).toContain('assoc."nomesUpper" IS NOT NULL');
      expect(sql).not.toContain('= ANY($5::text[])');
    });

    // Postgres infers a bind parameter's type from how it is used in the query text. When
    // todosConsorcios dropped $5 entirely, the planner had no ::text[] cast or comparison to
    // infer it from — since $6/$7 are still used further down, that raised "could not
    // determine data type of parameter $5" and the whole query failed (reported as "Todas as
    // Associações" returning nobody). $5 must still appear somewhere, even as a no-op.
    it('still references $5 in the SQL text when todosConsorcios is set, so Postgres can type it', () => {
      const sql = build({ consorcioFilterParamIndex: 5, todosConsorcios: true });

      expect(sql).toContain('$5::text[]');
    });

    // The two known associations (SINGAERJ, ANGLAE) are real rows in ordem_pagamento_guardador
    // with roleId 1, not 6 — the guardador role must always be required, filtered or not,
    // otherwise a selected consorcio would also bring back the association's own payment.
    it('requires the guardador role even when a consorcio is selected', () => {
      const withConsorcio = build({ consorcioFilterParamIndex: 5 });
      const roleIdOccurrences = withConsorcio.match(/pu\."roleId" = 6/g) ?? [];

      // Once per branch of the query: the paid-pending one has two (the regular branch and the
      // PASSO 0 children branch).
      expect(roleIdOccurrences).toHaveLength(name === 'pendenciaPagaSingleDate' ? 2 : 1);
    });

    it('requires the guardador role when todosConsorcios is set', () => {
      const sql = build({ consorcioFilterParamIndex: 5, todosConsorcios: true });

      expect(sql).toContain('pu."roleId" = 6');
    });

    // Associations (SINGAERJ, ANGLAE) have rows in ordem_pagamento_guardador but
    // are not guardadores: the default view (no consorcio selected) keeps to roleId 6.
    it('only includes users with the guardador role in the default view', () => {
      expect(build()).toContain('pu."roleId" = 6');
    });

    it('keeps the fallback name for guardadores without association', () => {
      expect(build()).toContain("'Guardador Autônomo'");
    });
  });
  // "Data Tentativa Pagamento" of a Pendencia Paga without a parent order is the date of
  // the order(s) it regroups, not the vencimento of the payment that settled them.
  describe.each([
    ['base', buildGuardadorBaseQuery],
    ['pendenciaPagaSingleDate', buildGuardadorPendenciaPagaSingleDateQuery],
  ])('%s query dataReferencia', (_name, build) => {
    it('uses the oldest dataOrdem of the opg for a Pendencia Paga without parent order', () => {
      const sql = build();

      expect(sql).toMatch(/oph\."statusRemessa" = 5\s+AND opa\."ordemPagamentoAgrupadoId" IS NULL/);
      expect(sql).toContain('MIN(g."dataOrdem")');
    });

    it('keeps the vencimento as dataReferencia for every other row', () => {
      expect(build()).toContain('ELSE da."dataVencimento"');
    });
  });
  // A correlated NOT EXISTS over ordem_pagamento_agrupado let the planner choose a nested-loop
  // anti join that scans ~280k rows per outer row as soon as a filter (status, consorcio)
  // made it underestimate the rows: 30s+ per query. An uncorrelated NOT IN is hashed once.
  describe.each([
    ['base', buildGuardadorBaseQuery],
    ['pendenciaPagaSingleDate', buildGuardadorPendenciaPagaSingleDateQuery],
  ])('%s query orders without children', (name, build) => {
    it('uses an uncorrelated NOT IN instead of a correlated NOT EXISTS', () => {
      const sql = build();

      // The only NOT EXISTS allowed is the PASSO 0 children anti-join of the paid-pending
      // query (children with no detalhe_a at all); it is index-driven and runs per candidate.
      const notExistsOccurrences = sql.match(/NOT EXISTS/gi) ?? [];
      expect(notExistsOccurrences).toHaveLength(name === 'pendenciaPagaSingleDate' ? 1 : 0);
      expect(sql).toMatch(
        /opa\.id NOT IN \(\s*SELECT filha\."ordemPagamentoAgrupadoId"\s+FROM ordem_pagamento_agrupado filha\s+WHERE filha\."ordemPagamentoAgrupadoId" IS NOT NULL\s*\)/,
      );
    });
  });

  // buildGuardadorAPagarQuery already bound $6/$7 to a valor range; buildGuardadorBaseQuery
  // silently ignored them, so filtering by valor on the base statuses returned nothing.
  describe.each([
    ['base', buildGuardadorBaseQuery],
    ['aPagar', buildGuardadorAPagarQuery],
  ])('%s query valor range', (_name, build) => {
    it('binds $6/$7 as an optional valor range filter', () => {
      const sql = build();

      expect(sql).toMatch(/\$6::numeric IS NULL OR .*>= \$6::numeric/);
      expect(sql).toMatch(/\$7::numeric IS NULL OR .*<= \$7::numeric/);
    });
  });

  describe('single-day payment-pending parent query', () => {
    it('filters the parent attempt date and reads its latest payment history', () => {
      const sql = buildGuardadorPendenciaPagamentoSingleDateQuery({
        parentErrorStatuses: ['Rejeitado'],
      });

      expect(sql).toContain('op_pai."dataPagamento"::date BETWEEN $1::date AND $2::date');
      expect(sql).toContain('MAX(oph_mais_recente.id)');
      expect(sql).toContain('oph_pai."motivoStatusRemessa"');
      expect(sql).toContain("IN ('Rejeitado')");
    });

    it('keeps the child value while exposing the parent error occurrence', () => {
      const sql = buildGuardadorPendenciaPagamentoSingleDateQuery({
        parentErrorStatuses: ['Estorno'],
      });

      expect(sql).toContain('da."valorLancamento" AS valor');
      expect(sql).toContain('op_pai."dataPagamento" AS "dataReferencia"');
      expect(sql).toContain('TRIM(oph_pai."motivoStatusRemessa")');
      expect(sql).toContain("IN ('Estorno')");
    });

    // Estorno/Rejeitado without a parent (never had a retry/correction attempt) were silently
    // dropped from the single-day filter: the family branch above requires
    // opa."ordemPagamentoAgrupadoId" via INNER JOIN with op_pai, so a first-level order with no
    // family history never matched it (same cause as ADR 0008, already fixed for the
    // permissionário in novo-remessa-query-builder.ts, but not for the guardador).
    it('also selects a single-day rejected/estornado guardador order that has no parent (no retry history)', () => {
      const sql = buildGuardadorPendenciaPagamentoSingleDateQuery({
        parentErrorStatuses: ['Estorno'],
      });

      expect(sql).toMatch(/UNION ALL/);
      expect(sql).toContain('opa."ordemPagamentoAgrupadoId" IS NULL');
      expect(sql).toContain('opa."dataPagamento"::date BETWEEN $1::date AND $2::date');
    });
  });

  // da.dataVencimento is a `timestamp without time zone` column written at 03:00:00 (midnight
  // in Brasília). A plain BETWEEN $1 AND $2 compares it against the implicit
  // 'yyyy-MM-dd 00:00:00', silently excluding the last day of the period (ADR 0005).
  describe('período (dataVencimento)', () => {
    it('base query casts the period filter to date', () => {
      const sql = buildGuardadorBaseQuery();

      expect(sql).toContain('da."dataVencimento"::date BETWEEN $1::date AND $2::date');
    });

    // opg.dataOrdem is a plain `date` column (no time component): it never had this bug and
    // must not get the cast.
    it('aPagar query keeps filtering dataOrdem without a date cast', () => {
      const sql = buildGuardadorAPagarQuery();

      expect(sql).toContain('opg."dataOrdem" BETWEEN $1 AND $2');
    });
  });

  // Every select of the UNION ALL must expose the same columns. The occurrence code (used to
  // describe the error) only exists for rows read from the payment history.
  describe.each(Object.entries(builders))('%s query codigoErro', (name, build) => {
    it('exposes the codigoErro column', () => {
      expect(build()).toContain('AS "codigoErro"');
    });

    it(
      name === 'base'
        ? 'reads the occurrence code only for Estorno and Rejeitado rows'
        : 'has no occurrence code, since the row is never an error',
      () => {
        const sql = build();

        if (name === 'base') {
          expect(sql).toContain(`IN ('Estorno', 'Rejeitado')`);
          expect(sql).toContain('TRIM(oph."motivoStatusRemessa")');
        } else {
          expect(sql).toContain('NULL::text AS "codigoErro"');
        }
      },
    );
  });
});
