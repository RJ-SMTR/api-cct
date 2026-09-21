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

    it('aggregates the associations of a guardador into a single joined row', () => {
      expect(build()).toMatch(/LEFT JOIN LATERAL/i);
    });

    // Purely visual: joining both names would make the column too long for the front.
    it('displays a single association name instead of concatenating them', () => {
      const sql = build();

      expect(sql).not.toMatch(/STRING_AGG/i);
      expect(sql).toMatch(/\)\[1\] AS "fullName"/);
    });

    it('displays the association selected in the consorcio filter first', () => {
      const sql = build({ consorcioFilterParamIndex: 5 });

      expect(sql).toContain('ORDER BY COALESCE(UPPER(TRIM(a."fullName")) = ANY($5::text[]), false) DESC');
    });

    it('matches the consorcio filter against any association of the guardador', () => {
      const sql = build({ consorcioFilterParamIndex: 5 });

      expect(sql).toContain('&& $5::text[]');
    });

    // Associations (SINGAERJ, ANGLAE) have rows in ordem_pagamento_guardador but
    // are not guardadores: only users with roleId 6 belong to this report.
    it('only includes users with the guardador role', () => {
      expect(build()).toContain('pu."roleId" = 6');
    });

    it('keeps the fallback name for guardadores without association', () => {
      expect(build()).toContain("'Guardador Autônomo'");
    });
  });
});
