import { getDataMinimaAPagar, resolveInicioAPagar } from './data-minima-a-pagar';

const dia = (ano: number, mes: number, d: number) => new Date(ano, mes - 1, d, 15, 0, 0);
const meiaNoite = (ano: number, mes: number, d: number) => new Date(ano, mes - 1, d);

describe('getDataMinimaAPagar', () => {
  // 2026-11-10 e' terca-feira.
  it.each([
    ['terca', dia(2026, 11, 10), meiaNoite(2026, 11, 10)],
    ['quarta', dia(2026, 11, 11), meiaNoite(2026, 11, 10)],
    ['quinta', dia(2026, 11, 12), meiaNoite(2026, 11, 10)],
    ['sexta', dia(2026, 11, 13), meiaNoite(2026, 11, 10)],
    ['sabado', dia(2026, 11, 14), meiaNoite(2026, 11, 14)],
    ['domingo', dia(2026, 11, 15), meiaNoite(2026, 11, 14)],
    ['segunda', dia(2026, 11, 16), meiaNoite(2026, 11, 14)],
  ])('%s', (_nome, hoje, esperado) => {
    expect(getDataMinimaAPagar(hoje)).toEqual(esperado);
  });
});

describe('resolveInicioAPagar', () => {
  const hoje = dia(2026, 11, 10);

  it('moves a start before the cycle up to the cycle start', () => {
    expect(resolveInicioAPagar(meiaNoite(2026, 11, 7), hoje)).toEqual(meiaNoite(2026, 11, 10));
  });

  it('keeps a start after the cycle start', () => {
    expect(resolveInicioAPagar(meiaNoite(2026, 11, 12), hoje)).toEqual(meiaNoite(2026, 11, 12));
  });
});
