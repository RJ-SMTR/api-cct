import { camposDivergentes, fatia, hashOrdem, normalizarDadosOrdem } from './ordem-sync.utils';

describe('ordem-sync.utils', () => {
  const base = {
    bqId: 10,
    dataOrdem: '2026-10-09',
    idConsorcio: ' 12 ',
    idOperadora: 'op',
    operadoraCpfCnpj: '07280995780',
    idOrdemPagamento: 'ord',
    nomeConsorcio: 'STPL',
    nomeOperadora: 'FULANO',
    valor: 10,
    valorGratuidade: null,
  };

  it('normaliza formatos equivalentes para o mesmo hash', () => {
    const banco = { ...base, bqId: '10', dataOrdem: new Date('2026-10-09T00:00:00Z'), idConsorcio: '12', valor: '10.00000', valorGratuidade: '0' };
    const bq = { ...base, valorGratuidade: 0 };
    expect(hashOrdem(normalizarDadosOrdem(banco))).toBe(hashOrdem(normalizarDadosOrdem(bq)));
  });

  it('muda o hash quando um campo comparado muda e aponta o campo divergente', () => {
    const a = normalizarDadosOrdem(base);
    const b = normalizarDadosOrdem({ ...base, valor: 10.01 });
    expect(hashOrdem(a)).not.toBe(hashOrdem(b));
    expect(camposDivergentes(a, b)).toEqual(['valor']);
    expect(camposDivergentes(a, a)).toEqual([]);
  });

  it('trata vazio e nulo como iguais e devolve a fatia pedida', () => {
    const a = normalizarDadosOrdem({ ...base, nomeOperadora: '  ' });
    const b = normalizarDadosOrdem({ ...base, nomeOperadora: null });
    expect(camposDivergentes(a, b)).toEqual([]);
    expect(fatia(normalizarDadosOrdem(base), ['valor', 'nomeConsorcio'])).toEqual({ valor: '10.00000', nomeConsorcio: 'STPL' });
  });
});
