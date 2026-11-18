import { filtrarPeloTotalDoFavorecido, pivotStucGratuidadeRows } from './stuc-gratuidade-pivot';

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

describe('filtrarPeloTotalDoFavorecido', () => {
  const janelas = [row(sexta, 600, 'Ana'), row(terca, 600, 'Ana'), row(sexta, 900, 'Bia')];

  it('valor mínimo compara o total do favorecido, não cada janela', () => {
    expect(filtrarPeloTotalDoFavorecido(janelas, porFavorecido, 1000)).toEqual([janelas[0], janelas[1]]);
  });

  it('valor máximo compara o total do favorecido, não cada janela', () => {
    expect(filtrarPeloTotalDoFavorecido(janelas, porFavorecido, undefined, 1000)).toEqual([janelas[2]]);
  });

  it('sem filtro de valor devolve as mesmas linhas', () => {
    expect(filtrarPeloTotalDoFavorecido(janelas, porFavorecido)).toBe(janelas);
  });
});

describe('pivotStucGratuidadeRows', () => {
  it('com uma única linha, preenche a 1ª posição com o valor e as demais da janela com 0 na data real do dia', () => {
    const [resultado] = pivotStucGratuidadeRows([row(sexta, 100)], porFavorecido);

    expect(resultado.dataOrdemPagamento1).toEqual(sexta);
    expect(resultado.valorOrdemPagamento1).toBe(100);
    expect(resultado.dataOrdemPagamento2).toEqual(sabado);
    expect(resultado.valorOrdemPagamento2).toBe(0);
    expect(resultado.dataOrdemPagamento3).toEqual(domingo);
    expect(resultado.valorOrdemPagamento3).toBe(0);
    expect(resultado.dataOrdemPagamento4).toEqual(segunda);
    expect(resultado.valorOrdemPagamento4).toBe(0);
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

  it('com os 3 dias de uma janela de terça-quinta, deixa a 4ª posição vazia (ela não existe nessa janela)', () => {
    const rows = [row(terca, 1), row(quarta, 2), row(quinta, 3)];
    const [resultado] = pivotStucGratuidadeRows(rows, porFavorecido);

    expect(resultado.dataOrdemPagamento3).toEqual(quinta);
    expect(resultado.valorOrdemPagamento3).toBe(3);
    expect(resultado.dataOrdemPagamento4).toBeNull();
    expect(resultado.valorOrdemPagamento4).toBeNull();
    expect(resultado.valor).toBe(6);
  });

  it('preenche com 0 e a data real o dia sem lançamento no meio de uma janela de terça-quinta, sem criar a 4ª posição', () => {
    const rows = [row(terca, 1), row(quinta, 3)];
    const [resultado] = pivotStucGratuidadeRows(rows, porFavorecido);

    expect(resultado.dataOrdemPagamento1).toEqual(terca);
    expect(resultado.valorOrdemPagamento1).toBe(1);
    expect(resultado.dataOrdemPagamento2).toEqual(quarta);
    expect(resultado.valorOrdemPagamento2).toBe(0);
    expect(resultado.dataOrdemPagamento3).toEqual(quinta);
    expect(resultado.valorOrdemPagamento3).toBe(3);
    expect(resultado.dataOrdemPagamento4).toBeNull();
    expect(resultado.valorOrdemPagamento4).toBeNull();
    expect(resultado.valor).toBe(4);
  });

  it('repete os demais campos do firstRow do grupo na posição backfilled, não só nas com lançamento', () => {
    const rows = [row(sexta, 10, 'Fulano')];
    const [resultado] = pivotStucGratuidadeRows(rows, porFavorecido);

    expect(resultado.favorecido).toBe('Fulano');
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

  describe('janela do mesmo favorecido repartida em mais de uma linha (ex.: status diferentes)', () => {
    type RowComStatus = Row & { status: string };
    const comStatus = (dataReferencia: Date, valor: number, status: string): RowComStatus => ({ ...row(dataReferencia, valor), status });
    const porFavorecidoEStatus = (r: RowComStatus) => `${r.favorecido}::${r.status}`;
    const soFavorecido = (r: RowComStatus) => r.favorecido;

    it('não mostra Valor Ordem 0 num dia que tem valor em outra linha do mesmo favorecido e janela', () => {
      const rows = [comStatus(sexta, 100, 'Pago'), comStatus(sabado, 50, 'A Pagar')];
      const resultado = pivotStucGratuidadeRows(rows, porFavorecidoEStatus, soFavorecido);

      const sabadoZerado = resultado.filter((r) => r.dataOrdemPagamento2?.getTime() === sabado.getTime() && r.valorOrdemPagamento2 === 0);
      const sextaZerada = resultado.filter((r) => r.dataOrdemPagamento1?.getTime() === sexta.getTime() && r.valorOrdemPagamento1 === 0);
      expect(sabadoZerado).toEqual([]);
      expect(sextaZerada).toEqual([]);

      const pago = resultado.find((r) => r.status === 'Pago')!;
      const aPagar = resultado.find((r) => r.status === 'A Pagar')!;
      expect(pago.valorOrdemPagamento1).toBe(100);
      expect(pago.dataOrdemPagamento2).toBeNull();
      expect(pago.valorOrdemPagamento2).toBeNull();
      expect(aPagar.valorOrdemPagamento2).toBe(50);
      expect(aPagar.dataOrdemPagamento1).toBeNull();
      expect(aPagar.valorOrdemPagamento1).toBeNull();
    });

    it('dia sem lançamento em nenhuma das linhas aparece com 0 uma única vez, não repetido em cada linha', () => {
      const rows = [comStatus(sexta, 100, 'Pago'), comStatus(sabado, 50, 'A Pagar')];
      const resultado = pivotStucGratuidadeRows(rows, porFavorecidoEStatus, soFavorecido);

      const domingos = resultado.filter((r) => r.dataOrdemPagamento3?.getTime() === domingo.getTime());
      const segundas = resultado.filter((r) => r.dataOrdemPagamento4?.getTime() === segunda.getTime());
      expect(domingos.map((r) => r.valorOrdemPagamento3)).toEqual([0]);
      expect(segundas.map((r) => r.valorOrdemPagamento4)).toEqual([0]);
    });

    it('o Valor Lançamento de cada linha continua sendo a soma só dos seus dias', () => {
      const rows = [comStatus(sexta, 100, 'Pago'), comStatus(sabado, 50, 'A Pagar')];
      const resultado = pivotStucGratuidadeRows(rows, porFavorecidoEStatus, soFavorecido);

      expect(resultado.find((r) => r.status === 'Pago')!.valor).toBe(100);
      expect(resultado.find((r) => r.status === 'A Pagar')!.valor).toBe(50);
    });

    it('favorecidos diferentes não escondem os dias um do outro', () => {
      const rows = [{ ...comStatus(sexta, 100, 'Pago'), favorecido: 'Ana' }, { ...comStatus(sabado, 50, 'Pago'), favorecido: 'Bia' }];
      const resultado = pivotStucGratuidadeRows(rows, porFavorecidoEStatus, soFavorecido);

      const ana = resultado.find((r) => r.favorecido === 'Ana')!;
      expect(ana.dataOrdemPagamento2).toEqual(sabado);
      expect(ana.valorOrdemPagamento2).toBe(0);
    });
  });
});
