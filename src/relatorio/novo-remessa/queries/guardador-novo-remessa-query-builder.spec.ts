import {
  buildGuardadorAPagarQuery,
  buildGuardadorBaseQuery,
  buildGuardadorPendenciaPagaSingleDateQuery,
} from './guardador-novo-remessa-query-builder';

const builders = {
  base: buildGuardadorBaseQuery,
  aPagar: buildGuardadorAPagarQuery,
  pendenciaPagaSingleDate: buildGuardadorPendenciaPagaSingleDateQuery,
};

describe('guardador-novo-remessa-query-builder', () => {
  describe.each(Object.entries(builders))('%s query', (_name, build) => {
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

    // Associations (SINGAERJ, ANGLAE) are payees in ordem_pagamento_guardador too. Selecting
    // a consorcio must show that association's own payment, not the payments of every
    // guardador linked to it.
    it('matches the consorcio filter only against the association itself, not the guardadores linked to it', () => {
      const sql = build({ consorcioFilterParamIndex: 5 });

      expect(sql).toContain('pu."permitCode" IS NULL');
      expect(sql).toContain('UPPER(TRIM(pu."fullName")) = ANY($5::text[])');
      expect(sql).not.toContain('&& $5::text[]');
    });

    // "Todas as Associações" must show every association's own payment, still excluding
    // the guardadores linked to them, regardless of which names $5 would hold.
    it('matches every association and excludes guardadores when todosConsorcios is set', () => {
      const sql = build({ consorcioFilterParamIndex: 5, todosConsorcios: true });

      expect(sql).toContain('pu."permitCode" IS NULL');
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
    // with roleId 1, not 6 — requiring roleId = 6 unconditionally would make a selected
    // consorcio always return zero rows, even though its own payment exists.
    it('does not require the guardador role for the association itself, only for the default guardador view', () => {
      const withConsorcio = build({ consorcioFilterParamIndex: 5 });
      const roleIdOccurrences = withConsorcio.match(/pu\."roleId" = 6/g) ?? [];

      expect(roleIdOccurrences).toHaveLength(1);
    });

    it('does not require the guardador role when todosConsorcios is set', () => {
      const sql = build({ consorcioFilterParamIndex: 5, todosConsorcios: true });

      expect(sql).not.toContain('pu."roleId" = 6');
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
  ])('%s query orders without children', (_name, build) => {
    it('uses an uncorrelated NOT IN instead of a correlated NOT EXISTS', () => {
      const sql = build();

      expect(sql).not.toMatch(/NOT EXISTS/i);
      expect(sql).toMatch(
        /opa\.id NOT IN \(\s*SELECT filha\."ordemPagamentoAgrupadoId"\s+FROM ordem_pagamento_agrupado filha\s+WHERE filha\."ordemPagamentoAgrupadoId" IS NOT NULL\s*\)/,
      );
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
