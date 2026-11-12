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
const repository = { findGroupedRows: jest.fn().mockResolvedValue(linhas) } as unknown as BasePagamentoRepository;
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
