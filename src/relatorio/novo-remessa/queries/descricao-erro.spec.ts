import {
  buildCodigoErroSql,
  getDescricaoErro,
} from './descricao-erro';
import { RelatorioFinancialMovementNovoRemessaData } from '../../dtos/relatorio-financial-and-movement.dto';

describe('descricao-erro', () => {
  describe('getDescricaoErro', () => {
    it('describes the occurrence code of an Estorno', () => {
      expect(getDescricaoErro('Estorno', '02')).toBe('Crédito ou Débito Cancelado pelo Pagador/Credor');
    });

    it('describes the occurrence code of a Rejeitado', () => {
      expect(getDescricaoErro('Rejeitado', 'AG')).toBe('Agência/Conta corrente/DV inválido');
    });

    it('is empty for statuses that are not an error, even when a code is given', () => {
      expect(getDescricaoErro('Pago', '00')).toBeUndefined();
      expect(getDescricaoErro('A Pagar', 'AG')).toBeUndefined();
      expect(getDescricaoErro('Pendencia Paga', 'AG')).toBeUndefined();
    });

    it('is empty when the error has no occurrence code', () => {
      expect(getDescricaoErro('Rejeitado', null)).toBeUndefined();
      expect(getDescricaoErro('Rejeitado', '')).toBeUndefined();
      expect(getDescricaoErro('Rejeitado', undefined)).toBeUndefined();
    });

    it('describes the code ANHO as "Conta digital"', () => {
      expect(getDescricaoErro('Rejeitado', 'ANHO')).toBe('Conta digital');
      expect(getDescricaoErro('Estorno', ' ANHO ')).toBe('Conta digital');
    });

    it('shows the raw code when it is not mapped, instead of hiding the error', () => {
      expect(getDescricaoErro('Rejeitado', 'QQ')).toBe('Código QQ');
    });

    // Grouped rows (one per date/consorcio/status) aggregate the codes with a comma.
    it('joins the distinct descriptions of an aggregated list of codes', () => {
      expect(getDescricaoErro('Rejeitado', 'AG,AN,AG')).toBe(
        'Agência/Conta corrente/DV inválido / Conta Corrente / DV do favorecido inválido',
      );
    });
  });

  describe('buildCodigoErroSql', () => {
    it('only returns the occurrence code when the status is Estorno or Rejeitado', () => {
      const sql = buildCodigoErroSql('CASE WHEN x THEN 1 END');

      expect(sql).toContain("IN ('Estorno', 'Rejeitado')");
      expect(sql).toContain('TRIM(oph."motivoStatusRemessa")');
    });
  });

  describe('RelatorioFinancialMovementNovoRemessaData', () => {
    it('turns the raw codigoErro of a row into descricaoErro and does not expose the code', () => {
      const row = new RelatorioFinancialMovementNovoRemessaData({
        status: 'Rejeitado',
        codigoErro: 'AG',
      } as any);

      expect(row.descricaoErro).toBe('Agência/Conta corrente/DV inválido');
      expect((row as any).codigoErro).toBeUndefined();
    });

    it('leaves descricaoErro empty for a Pago row', () => {
      const row = new RelatorioFinancialMovementNovoRemessaData({
        status: 'Pago',
        codigoErro: null,
      } as any);

      expect(row.descricaoErro).toBeUndefined();
    });
  });
});
