import { RelatorioConsolidadoNovoRemessaDto } from '../dtos/relatorio-consolidado-novo-remessa.dto';
import { agruparStucPorFavorecido } from './stuc-por-favorecido';

describe('agruparStucPorFavorecido', () => {
  const janelas = new RelatorioConsolidadoNovoRemessaDto({
    count: 4,
    valor: 1000.3,
    valorAPagar: 0,
    data: [
      { nomefavorecido: 'WILLIAM', cpfCnpj: '1', valor: 655.1, dataOrdemPagamento1: '02/10/2026' } as any,
      { nomefavorecido: 'WILLIAM', cpfCnpj: '2', valor: 155 } as any,
      { nomefavorecido: 'ANA', cpfCnpj: '3', valor: 100.1 } as any,
      { nomefavorecido: 'WILLIAM', cpfCnpj: '1', valor: 90.1 } as any,
    ],
  });

  it('returns one row per favorecido with the period total, keeping homonyms apart', () => {
    const resultado = agruparStucPorFavorecido(janelas);

    expect(resultado.data.map((linha) => [linha.nomefavorecido, linha.cpfCnpj, linha.valor])).toEqual([
      ['ANA', '3', 100.1],
      ['WILLIAM', '1', 745.2],
      ['WILLIAM', '2', 155],
    ]);
    expect(resultado.count).toBe(3);
    expect(resultado.valor).toBe(1000.3);
  });

  it('drops the window date fields', () => {
    expect(agruparStucPorFavorecido(janelas).data[1]).not.toHaveProperty('dataOrdemPagamento1');
  });
});
