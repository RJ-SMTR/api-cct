import { DataSource } from 'typeorm';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { StucGratuidadeRepository } from './stuc-gratuidade.repository';

// Relatorios sempre em ordem alfabetica do nome, qualquer filtro: a consulta devolve os dias por
// data, o pivot monta as janelas, e a lista final sai por nome e, no mesmo nome, pela janela.
describe('StucGratuidadeRepository - ordem alfabetica', () => {
  const dia = (nomes: string, dataReferencia: Date, valor: string) => ({
    nomes,
    cpfCnpj: nomes === 'ZULMIRA' ? '22222222222' : nomes === 'ÁLVARO' ? '33333333333' : '11111111111',
    nomeConsorcio: null,
    status: StatusPagamento.PAGO,
    dataReferencia,
    valor,
  });

  it('lista as janelas por nome (pt-BR, acento nao joga o nome para o fim) e, no mesmo nome, por data', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([
        dia('ZULMIRA', new Date(2026, 9, 23), '10'),
        dia('BRUNO', new Date(2026, 9, 23), '20'),
        dia('ÁLVARO', new Date(2026, 9, 27), '30'),
        dia('BRUNO', new Date(2026, 9, 27), '40'),
        dia('ÁLVARO', new Date(2026, 9, 23), '50'),
      ]),
    } as unknown as DataSource;

    const rows = await new StucGratuidadeRepository(dataSource).findRows({ dataInicio: new Date(2026, 9, 1), dataFim: new Date(2026, 9, 31) });

    expect(rows.map((row) => [row.nomes, row.valor])).toEqual([
      ['ÁLVARO', 50],
      ['ÁLVARO', 30],
      ['BRUNO', 20],
      ['BRUNO', 40],
      ['ZULMIRA', 10],
    ]);
  });

  // Achado do Verifier: uma janela repartida (status diferentes) deixa a 1a posicao vazia na
  // segunda linha - ela nao pode subir para antes das janelas anteriores do mesmo nome.
  it('janela repartida em duas linhas fica na posicao da sua data, nao antes das janelas anteriores', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([
        dia('BRUNO', new Date(2026, 9, 20), '5'),
        dia('BRUNO', new Date(2026, 9, 23), '10'),
        { ...dia('BRUNO', new Date(2026, 9, 24), '20'), status: StatusPagamento.A_PAGAR },
      ]),
    } as unknown as DataSource;

    const rows = await new StucGratuidadeRepository(dataSource).findRows({ dataInicio: new Date(2026, 9, 1), dataFim: new Date(2026, 9, 31) });

    expect(rows.map((row) => row.valor)).toEqual([5, 10, 20]);
  });

  it('janela repartida nao mostra Valor Ordem 0 num dia que tem valor na outra linha', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([
        dia('BRUNO', new Date(2026, 9, 23), '10'),
        { ...dia('BRUNO', new Date(2026, 9, 24), '20'), status: StatusPagamento.A_PAGAR },
      ]),
    } as unknown as DataSource;

    const rows = await new StucGratuidadeRepository(dataSource).findRows({ dataInicio: new Date(2026, 9, 1), dataFim: new Date(2026, 9, 31) });

    const sabado = new Date(2026, 9, 24).getTime();
    const valoresDoSabado = rows.filter((row) => row.dataOrdemPagamento2?.getTime() === sabado).map((row) => row.valorOrdemPagamento2);
    expect(valoresDoSabado).toEqual([20]);
  });
});
