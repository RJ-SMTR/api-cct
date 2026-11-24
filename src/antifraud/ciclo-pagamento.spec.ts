import { getCicloPagamento } from './ciclo-pagamento';

describe('getCicloPagamento', () => {
  const ciclo = (iso: string) => {
    const { dataInicio, dataFim, dataPagamento } = getCicloPagamento(new Date(iso));
    return { dataInicio, dataFim, dataPagamento };
  };

  it.each([
    ['2026-11-20T23:00:00.000Z', 'sexta'],
    ['2026-11-21T12:00:00.000Z', 'sábado'],
    ['2026-11-22T12:00:00.000Z', 'domingo'],
    ['2026-11-23T23:00:00.000Z', 'segunda (horário do alerta)'],
  ])('%s (%s) cai no ciclo de sexta a segunda, pago na terça', (iso) => {
    expect(ciclo(iso)).toEqual({
      dataInicio: '2026-11-20',
      dataFim: '2026-11-23',
      dataPagamento: '2026-11-24',
    });
  });

  it.each([
    ['2026-11-24T00:00:00.000Z', 'terça'],
    ['2026-11-25T12:00:00.000Z', 'quarta'],
    ['2026-11-26T23:00:00.000Z', 'quinta (horário do alerta)'],
  ])('%s (%s) cai no ciclo de terça a quinta, pago na sexta', (iso) => {
    expect(ciclo(iso)).toEqual({
      dataInicio: '2026-11-24',
      dataFim: '2026-11-26',
      dataPagamento: '2026-11-27',
    });
  });

  it('usa o dia em UTC, não o fuso local', () => {
    // 2026-11-24 01:00 UTC = segunda 22:00 BRT; em UTC já é terça.
    expect(ciclo('2026-11-24T01:00:00.000Z').dataInicio).toBe('2026-11-24');
  });

  it('atravessa a virada de mês e de ano', () => {
    expect(ciclo('2026-12-31T23:00:00.000Z')).toEqual({
      dataInicio: '2026-12-29',
      dataFim: '2026-12-31',
      dataPagamento: '2027-01-01',
    });
    expect(ciclo('2027-01-04T23:00:00.000Z')).toEqual({
      dataInicio: '2027-01-01',
      dataFim: '2027-01-04',
      dataPagamento: '2027-01-05',
    });
  });
});
