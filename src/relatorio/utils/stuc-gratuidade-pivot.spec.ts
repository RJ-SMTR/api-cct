import { pivotStucGratuidadeRows } from './stuc-gratuidade-pivot';

type Row = { dataReferencia: Date; valor: number; favorecido: string };

const row = (dataReferencia: Date, valor: number, favorecido = 'Fulano'): Row => ({ dataReferencia, valor, favorecido });
const porFavorecido = (r: Row) => r.favorecido;

// Janela sexta-segunda (2026-10-23 a 2026-10-26).
const sexta = new Date(2026, 9, 23);
const sabado = new Date(2026, 9, 24);
const domingo = new Date(2026, 9, 25);
const segunda = new Date(2026, 9, 26);
// Janela terça-quinta da semana seguinte (2026-10-27 a 2026-10-29).
const terca = new Date(2026, 9, 27);
const quarta = new Date(2026, 9, 28);
const quinta = new Date(2026, 9, 29);

describe('pivotStucGratuidadeRows', () => {
  it('com uma única linha, preenche só a primeira posição e mantém o valor', () => {
    const [resultado] = pivotStucGratuidadeRows([row(sexta, 100)], porFavorecido);

    expect(resultado.dataOrdemPagamento1).toEqual(sexta);
    expect(resultado.valorOrdemPagamento1).toBe(100);
    expect(resultado.dataOrdemPagamento2).toBeNull();
    expect(resultado.valorOrdemPagamento2).toBeNull();
    expect(resultado.valor).toBe(100);
  });

  it('com os 4 dias de uma janela de sexta-segunda, preenche as 4 posições e soma o valor', () => {
    const rows = [row(sexta, 10), row(sabado, 20), row(domingo, 30), row(segunda, 40)];
    const [resultado] = pivotStucGratuidadeRows(rows, porFavorecido);

    expect(resultado.dataOrdemPagamento1).toEqual(sexta);
    expect(resultado.valorOrdemPagamento1).toBe(10);
    expect(resultado.dataOrdemPagamento2).toEqual(sabado);
    expect(resultado.valorOrdemPagamento2).toBe(20);
    expect(resultado.dataOrdemPagamento3).toEqual(domingo);
    expect(resultado.valorOrdemPagamento3).toBe(30);
    expect(resultado.dataOrdemPagamento4).toEqual(segunda);
    expect(resultado.valorOrdemPagamento4).toBe(40);
    expect(resultado.valor).toBe(100);
  });

  it('com os 3 dias de uma janela de terça-quinta, deixa a 4ª posição vazia', () => {
    const rows = [row(terca, 1), row(quarta, 2), row(quinta, 3)];
    const [resultado] = pivotStucGratuidadeRows(rows, porFavorecido);

    expect(resultado.dataOrdemPagamento3).toEqual(quinta);
    expect(resultado.valorOrdemPagamento3).toBe(3);
    expect(resultado.dataOrdemPagamento4).toBeNull();
    expect(resultado.valorOrdemPagamento4).toBeNull();
    expect(resultado.valor).toBe(6);
  });

  it('soma duas linhas do mesmo dia na mesma posição, em vez de duplicar', () => {
    const rows = [row(sexta, 10), row(sexta, 5)];
    const [resultado] = pivotStucGratuidadeRows(rows, porFavorecido);

    expect(resultado.dataOrdemPagamento1).toEqual(sexta);
    expect(resultado.valorOrdemPagamento1).toBe(15);
    expect(resultado.valor).toBe(15);
  });

  it('gera duas linhas de saída para duas janelas diferentes do mesmo favorecido', () => {
    const rows = [row(sexta, 10), row(terca, 20)];
    const resultado = pivotStucGratuidadeRows(rows, porFavorecido);

    expect(resultado).toHaveLength(2);
    expect(resultado.map((r) => r.valor).sort()).toEqual([10, 20]);
  });

  it('nunca mistura linhas de favorecidos diferentes na mesma linha de saída', () => {
    const rows = [row(sexta, 10, 'Fulano'), row(sexta, 20, 'Ciclano')];
    const resultado = pivotStucGratuidadeRows(rows, porFavorecido);

    expect(resultado).toHaveLength(2);
    const porNome = Object.fromEntries(resultado.map((r) => [r.favorecido, r.valor]));
    expect(porNome).toEqual({ Fulano: 10, Ciclano: 20 });
  });

  it('com lista vazia, devolve lista vazia', () => {
    expect(pivotStucGratuidadeRows([], porFavorecido)).toEqual([]);
  });

  it('soma corretamente quando "valor" vem como string (pg devolve numeric/decimal como string)', () => {
    // Regressão: "sum + valor" sem Number() vira concatenação assim que um operando é string
    // ("80.00000" + "10.00000" = "080.0000010.00000"), não soma. Confirmado via Movimentação
    // Financeira, cujo SUM(valor) do SQL chega como string ao Node - diferente do Consolidado,
    // que já convertia para número antes de chamar o pivot.
    const rows = [row(sexta, '80.00000' as unknown as number), row(sabado, '10.00000' as unknown as number)];
    const [resultado] = pivotStucGratuidadeRows(rows, porFavorecido);

    expect(resultado.valorOrdemPagamento1).toBe(80);
    expect(resultado.valorOrdemPagamento2).toBe(10);
    expect(resultado.valor).toBe(90);
  });
});
