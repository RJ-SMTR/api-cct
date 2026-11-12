import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { BasePagamentoRepository, BasePagamentoRow } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { ConsolidadoCombinadoService } from './consolidado-combinado.service';
import { ConsorcioAggregatorService } from './consorcio-aggregator.service';
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

const row = (nomes: string, nomeConsorcio: string, valor = '10'): BasePagamentoRow => ({
  dataReferencia: new Date('2098-01-10T12:00:00.000Z'),
  nomes,
  cpfCnpj: '11111111111',
  nomeConsorcio,
  valor,
  status: StatusPagamento.PAGO,
});

// Linhas chegam do banco fora de ordem, como acontece em producao.
const linhas = [
  row('ZULEICA', 'VLT'),
  row('ÁLVARO', 'Internorte'),
  row('bruno', 'STPC'),
  row('MARIA', 'Intersul'),
  row('ANA', 'MobiRio'),
];
// Same grouping BasePagamentoRepository.findTotaisPorFavorecido does in SQL (ADR 0023), over the fake rows.
const totaisPorFavorecido = (rows: BasePagamentoRow[]) => {
  const grupos = new Map<string, { nome: string; cpfCnpj: string | null; valor: number; valorAPagar: number }>();
  for (const r of rows.filter((linha) => linha.nomes !== null)) {
    const grupo = grupos.get(r.nomes) ?? { nome: r.nomes, cpfCnpj: r.cpfCnpj, valor: 0, valorAPagar: 0 };
    grupo.valor += Number(r.valor);
    grupo.valorAPagar += r.status === StatusPagamento.A_PAGAR ? Number(r.valor) : 0;
    grupos.set(r.nomes, grupo);
  }
  const valorSemFavorecido = rows.filter((linha) => linha.nomes === null).reduce((total, linha) => total + Number(linha.valor), 0);
  return { grupos: [...grupos.values()], valorSemFavorecido };
};

const repository = { findGroupedRows: jest.fn().mockResolvedValue(linhas), findTotaisPorFavorecido: jest.fn().mockResolvedValue(totaisPorFavorecido(linhas)) } as unknown as BasePagamentoRepository;
const periodo = { dataInicio: new Date('2098-01-10'), dataFim: new Date('2098-01-10') };
const nomes = (data: { nomefavorecido: string }[]) => data.map((item) => item.nomefavorecido);

describe('Consolidado v2 em ordem alfabetica', () => {
  it('lista os consorcios em ordem alfabetica com todos os consorcios', async () => {
    const resultado = await new ConsorcioAggregatorService(repository).aggregate(periodo, { todosConsorcios: true });

    expect(nomes(resultado.data)).toEqual(['Internorte', 'Intersul', 'MobiRio', 'STPC', 'VLT']);
  });

  it('lista os favorecidos em ordem alfabetica, ignorando acento e caixa', async () => {
    const resultado = await new VanzeiroAggregatorService(repository).aggregate(periodo);

    expect(nomes(resultado.data)).toEqual(['ÁLVARO', 'ANA', 'bruno', 'MARIA', 'ZULEICA']);
  });

  it('ordena a uniao de consorcios e favorecidos', async () => {
    const service = new ConsolidadoCombinadoService(new ConsorcioAggregatorService(repository), new VanzeiroAggregatorService(repository));
    const resultado = await service.aggregate(periodo, { todosVanzeiros: true, todosConsorcios: true });
    const lista = nomes(resultado.data);

    expect(lista).toEqual([...lista].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });
});
