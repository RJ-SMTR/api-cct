import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { buildEleicaoStatusPagamentoCaseSql, buildStatusPagamentoCaseSql, resolveStatusPagamento } from './status-resolver';

describe('status-resolver', () => {
  describe('resolveStatusPagamento', () => {
    it('resolves statusRemessa=5 to Pendencia Paga', () => {
      expect(resolveStatusPagamento(5, null)).toBe(StatusPagamento.PENDENCIA_PAGA);
    });

    it('resolves statusRemessa=2 to Aguardando Pagamento', () => {
      expect(resolveStatusPagamento(2, null)).toBe(StatusPagamento.AGUARDANDO_PAGAMENTO);
    });

    it('resolves statusRemessa 0 or 1 to A Pagar (uniao das duas populacoes, ADR 0017)', () => {
      expect(resolveStatusPagamento(0, null)).toBe(StatusPagamento.A_PAGAR);
      expect(resolveStatusPagamento(1, null)).toBe(StatusPagamento.A_PAGAR);
    });

    it('resolves motivo 00/BD or statusRemessa=3 to Pago', () => {
      expect(resolveStatusPagamento(4, '00')).toBe(StatusPagamento.PAGO);
      expect(resolveStatusPagamento(4, 'BD')).toBe(StatusPagamento.PAGO);
      expect(resolveStatusPagamento(3, null)).toBe(StatusPagamento.PAGO);
    });

    it('resolves motivo 02 to Estorno', () => {
      expect(resolveStatusPagamento(4, '02')).toBe(StatusPagamento.ERRO_ESTORNO);
    });

    it('resolves any other motivo (including AM) with statusRemessa=4 to Rejeitado, not confusing with MOTIVOS_NAO_REJEICAO', () => {
      // 'AM' nao conta como Pago/Estorno aqui, mesmo sendo "nao-rejeicao" para elegibilidade a
      // reprocessamento em regras-pendencia.ts (conceito diferente, fora deste resolver).
      expect(resolveStatusPagamento(4, 'AM')).toBe(StatusPagamento.ERRO_REJEITADO);
      expect(resolveStatusPagamento(4, 'AR')).toBe(StatusPagamento.ERRO_REJEITADO);
      expect(resolveStatusPagamento(4, null)).toBe(StatusPagamento.ERRO_REJEITADO);
    });
  });

  describe('buildStatusPagamentoCaseSql', () => {
    // Texto copiado literalmente de STATUS_CASE/GUARDADOR_STATUS_CASE
    // (novo-remessa-query-builder.ts / guardador-novo-remessa-query-builder.ts), fonte de
    // verdade independente desta implementacao — nao gerado pelo codigo sob teste.
    const EXPECTED_CASE_OPH = `
  CASE
    WHEN oph."statusRemessa" = 5 THEN 'Pendencia Paga'
    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;

    const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim();

    it('produces the same CASE as STATUS_CASE/GUARDADOR_STATUS_CASE for alias "oph"', () => {
      expect(normalize(buildStatusPagamentoCaseSql('oph'))).toBe(normalize(EXPECTED_CASE_OPH));
    });

    it('parameterizes the history alias', () => {
      expect(buildStatusPagamentoCaseSql('h')).toContain('h."statusRemessa"');
      expect(buildStatusPagamentoCaseSql('h')).not.toContain('oph."statusRemessa"');
    });
  });

  // T7 (ADR 0004): Eleição restricts the available buckets relative to the normal
  // buildStatusPagamentoCaseSql - no "Pendencia Paga" line, so statusRemessa=5 falls through to
  // the final ELSE ('Rejeitado') instead of its own bucket. That concept doesn't exist for
  // ordem_pagamento_unico's flow (product decision, not a gap to fix).
  describe('buildEleicaoStatusPagamentoCaseSql', () => {
    // Texto copiado literalmente de ELEICAO_STATUS_CASE (novo-remessa-query-builder.ts), fonte
    // de verdade independente desta implementacao - nao gerado pelo codigo sob teste.
    const EXPECTED_ELEICAO_CASE_OPH = `
  CASE
    WHEN oph."statusRemessa" = 2 THEN 'Aguardando Pagamento'
    WHEN oph."statusRemessa" IN (0,1) THEN 'A Pagar'
    WHEN oph."motivoStatusRemessa" IN ('00', 'BD') OR oph."statusRemessa" = 3 THEN 'Pago'
    WHEN oph."motivoStatusRemessa" = '02' THEN 'Estorno'
    ELSE 'Rejeitado'
  END
`;

    const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim();

    it('produces the same restricted CASE as ELEICAO_STATUS_CASE for alias "oph"', () => {
      expect(normalize(buildEleicaoStatusPagamentoCaseSql('oph'))).toBe(normalize(EXPECTED_ELEICAO_CASE_OPH));
    });

    it('has no "Pendencia Paga" line, unlike buildStatusPagamentoCaseSql', () => {
      expect(buildEleicaoStatusPagamentoCaseSql('oph')).not.toContain('Pendencia Paga');
      expect(buildStatusPagamentoCaseSql('oph')).toContain('Pendencia Paga');
    });

    it('parameterizes the history alias', () => {
      expect(buildEleicaoStatusPagamentoCaseSql('h')).toContain('h."statusRemessa"');
      expect(buildEleicaoStatusPagamentoCaseSql('h')).not.toContain('oph."statusRemessa"');
    });
  });
});
