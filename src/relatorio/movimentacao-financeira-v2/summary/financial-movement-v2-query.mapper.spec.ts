import { resolveCursorFromQuery } from './financial-movement-v2-query.mapper';

const periodo = { dataInicio: new Date('2098-01-01'), dataFim: new Date('2098-01-31') };

describe('resolveCursorFromQuery', () => {
  it('keeps the cursor of a row without a linked favorecido', () => {
    const cursor = resolveCursorFromQuery({ ...periodo, cursorDataReferencia: '2098-01-10', cursorStatus: 'A Pagar', cursorValor: '10.50000' });

    expect(cursor).toEqual({ dataReferencia: '2098-01-10', nomes: null, cpfCnpj: null, nomeConsorcio: null, status: 'A Pagar', valor: '10.50000' });
  });

  it.each([[{ cursorStatus: 'A Pagar' }], [{ cursorDataReferencia: '2098-01-10' }]])('returns no cursor for %j', (campos) => {
    expect(resolveCursorFromQuery({ ...periodo, ...campos })).toBeUndefined();
  });
});
