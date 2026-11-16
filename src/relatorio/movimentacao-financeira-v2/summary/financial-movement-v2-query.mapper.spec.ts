import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { FinancialMovementQueryDto } from '../../dtos/pay-and-pending-query.dto';
import { toExportRow } from '../export/financial-movement-v2-export.service';
import { mapQueryToFinancialMovementV2Filter, resolveCursorFromQuery } from './financial-movement-v2-query.mapper';

jest.mock('pdfkit', () => jest.fn(), { virtual: true });

const periodo = { dataInicio: new Date('2098-01-01'), dataFim: new Date('2098-01-31') };

describe('resolveCursorFromQuery', () => {
  it('keeps the cursor of a row without a linked favorecido', () => {
    const cursor = resolveCursorFromQuery({ ...periodo, cursorDataReferencia: '2098-01-10', cursorStatus: 'A Pagar', cursorValor: '10.50000' });

    expect(cursor).toEqual({ dataReferencia: '2098-01-10', nomes: null, cpfCnpj: null, nomeConsorcio: null, status: 'A Pagar', valor: '10.50000' });
  });

  it.each([[{ cursorStatus: 'A Pagar' }], [{ cursorDataReferencia: '2098-01-10' }]])('returns no cursor for %j', (campos) => {
    expect(resolveCursorFromQuery({ ...periodo, ...campos })).toBeUndefined();
  });

  it('carries the per-row key when the request sends it', () => {
    const cursor = resolveCursorFromQuery({ ...periodo, cursorDataReferencia: '2098-01-10', cursorStatus: 'A Pagar', cursorChaveLinha: 'nunca_enviada:7:0' });

    expect(cursor?.chaveLinha).toBe('nunca_enviada:7:0');
  });
});

describe('mapQueryToFinancialMovementV2Filter', () => {
  it('forwards cursorChaveLinha', () => {
    const filtro = mapQueryToFinancialMovementV2Filter({ ...periodo, cursorChaveLinha: 'agrupada:9' } as FinancialMovementQueryDto);

    expect(filtro.cursorChaveLinha).toBe('agrupada:9');
  });

  it('forwards desativados', () => {
    const filtro = mapQueryToFinancialMovementV2Filter({ ...periodo, desativados: true } as FinancialMovementQueryDto);

    expect(filtro.desativados).toBe(true);
  });

  // "Todos os guardadores" together with an association filter is a union (regra de Rayanne, 2026-11-13).
  it('forwards todosGuardadores', () => {
    const filtro = mapQueryToFinancialMovementV2Filter({ ...periodo, todosGuardadores: true } as FinancialMovementQueryDto);

    expect(filtro.todosGuardadores).toBe(true);
  });

  it('"Pago" brings the abatimento por duplicidade along (own status and total)', () => {
    const filtro = mapQueryToFinancialMovementV2Filter({ ...periodo, pago: true } as FinancialMovementQueryDto);

    expect(filtro.statuses).toEqual([StatusPagamento.PAGO, StatusPagamento.ABATIMENTO_DUPLICIDADE]);
  });

  it('keeps the abatimento out when "Pago" is not selected', () => {
    const filtro = mapQueryToFinancialMovementV2Filter({ ...periodo, aPagar: true } as FinancialMovementQueryDto);

    expect(filtro.statuses).toEqual([StatusPagamento.A_PAGAR]);
  });

  it('maps abatimentoDuplicidade to the "Abatimento por duplicidade" status', () => {
    const filtro = mapQueryToFinancialMovementV2Filter({ ...periodo, pago: true, abatimentoDuplicidade: true } as FinancialMovementQueryDto);

    expect(filtro.statuses).toEqual([StatusPagamento.PAGO, StatusPagamento.ABATIMENTO_DUPLICIDADE]);
  });
});

describe('toExportRow', () => {
  it('does not leak the cursor key into the output row', () => {
    const linha = toExportRow({ dataReferencia: new Date('2098-01-10T12:00:00.000Z'), nomes: 'A', cpfCnpj: '1', nomeConsorcio: null, valor: '1', status: StatusPagamento.A_PAGAR, chaveLinha: 'agrupada:9' });

    expect(JSON.stringify(linha)).not.toContain('agrupada:9');
  });

  it('shows the motivo of the abatimento in the description column', () => {
    const linha = toExportRow({
      dataReferencia: new Date('2098-01-10T12:00:00.000Z'),
      nomes: 'A',
      cpfCnpj: '1',
      nomeConsorcio: null,
      valor: '0',
      status: StatusPagamento.ABATIMENTO_DUPLICIDADE,
      motivo: 'Valor pago em duplicidade em 09/2097',
    });

    expect(linha.status).toBe('Abatimento por duplicidade');
    expect(linha.descricaoErro).toBe('Valor pago em duplicidade em 09/2097');
  });

  it('keeps the description empty for rows without motivo', () => {
    const linha = toExportRow({ dataReferencia: new Date('2098-01-10T12:00:00.000Z'), nomes: 'A', cpfCnpj: '1', nomeConsorcio: null, valor: '1', status: StatusPagamento.PAGO, motivo: null });

    expect(linha.descricaoErro).toBeUndefined();
  });
});
