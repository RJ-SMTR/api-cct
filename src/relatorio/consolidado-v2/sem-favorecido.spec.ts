import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { BasePagamentoRepository, BasePagamentoRow } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { buildSummaryFromRows } from '../movimentacao-financeira-v2/export/financial-movement-v2-export.service';
import { ConsolidadoCombinadoService } from './consolidado-combinado.service';
import { ConsorcioAggregatorService } from './consorcio-aggregator.service';
import { EleicaoAggregatorService } from './eleicao-aggregator.service';
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

jest.mock('pdfkit', () => jest.fn(), { virtual: true });

const row = (nomes: string | null, valor: string, cpfCnpj: string | null = '11111111111'): BasePagamentoRow => ({
  dataReferencia: new Date('2098-01-10T12:00:00.000Z'),
  nomes: nomes as string,
  cpfCnpj: cpfCnpj as string,
  nomeConsorcio: 'STPC',
  valor,
  status: StatusPagamento.A_PAGAR,
});

const linhas = [row('FAVORECIDO', '100'), row(null, '40', null), row(null, '2', null)];
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

// Same grouping BasePagamentoRepository.findTotaisPorConsorcio does in SQL (ADR 0023), over the fake rows.
const totaisPorConsorcio = (rows: BasePagamentoRow[]) => {
  const grupos = new Map<string, { nome: string; valor: number; valorAPagar: number }>();
  for (const r of rows.filter((linha) => linha.nomes !== null && linha.nomeConsorcio !== null)) {
    const grupo = grupos.get(r.nomeConsorcio as string) ?? { nome: r.nomeConsorcio as string, valor: 0, valorAPagar: 0 };
    grupo.valor += Number(r.valor);
    grupo.valorAPagar += r.status === StatusPagamento.A_PAGAR ? Number(r.valor) : 0;
    grupos.set(grupo.nome, grupo);
  }
  const valorSemFavorecido = rows.filter((linha) => linha.nomes === null).reduce((total, linha) => total + Number(linha.valor), 0);
  return { grupos: [...grupos.values()], valorSemFavorecido };
};

const repository = { findGroupedRows: jest.fn().mockResolvedValue(linhas), findTotaisPorFavorecido: jest.fn().mockResolvedValue(totaisPorFavorecido(linhas)), findTotaisPorConsorcio: jest.fn().mockResolvedValue(totaisPorConsorcio(linhas)), findEleicaoRows: jest.fn().mockResolvedValue(linhas) } as unknown as BasePagamentoRepository;
const periodo = { dataInicio: new Date('2098-01-10'), dataFim: new Date('2098-01-10') };

describe('ordens sem favorecido', () => {
  it('stay out of the Movimentacao totals and go to their own line', () => {
    expect(buildSummaryFromRows(linhas)).toEqual(expect.objectContaining({ count: 1, valorTotal: 100, valorAPagar: 100, valorSemFavorecido: 42 }));
  });

  it.each([
    ['favorecido', () => new VanzeiroAggregatorService(repository).aggregate(periodo)],
    ['consorcio', () => new ConsorcioAggregatorService(repository).aggregate(periodo, { todosConsorcios: true })],
    ['eleicao', () => new EleicaoAggregatorService(repository).aggregateByFavorecido(periodo)],
  ])('stay out of the Consolidado total, %s view', async (_visao, agregar) => {
    const resultado = await agregar();

    expect(resultado.valor).toBe(100);
    expect(resultado.valorAPagar).toBe(100);
    expect(resultado.valorSemFavorecido).toBe(42);
    expect(resultado.data).toHaveLength(1);
  });

  it('are counted once in the combined view', async () => {
    const service = new ConsolidadoCombinadoService(new ConsorcioAggregatorService(repository), new VanzeiroAggregatorService(repository));

    expect((await service.aggregate(periodo)).valorSemFavorecido).toBe(42);
  });
});
