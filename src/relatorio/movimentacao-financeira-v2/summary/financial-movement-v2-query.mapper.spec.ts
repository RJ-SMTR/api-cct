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
});

describe('toExportRow', () => {
  it('does not leak the cursor key into the output row', () => {
    const linha = toExportRow({ dataReferencia: new Date('2098-01-10T12:00:00.000Z'), nomes: 'A', cpfCnpj: '1', nomeConsorcio: null, valor: '1', status: StatusPagamento.A_PAGAR, chaveLinha: 'agrupada:9' });

    expect(JSON.stringify(linha)).not.toContain('agrupada:9');
  });
});
