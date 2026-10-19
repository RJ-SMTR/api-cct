import { OrdemPagamentoRepository } from './ordem-pagamento.repository';
import { BigQueryToOrdemPagamento } from '../convertTo/bigquery-to-ordem-pagamento.convert';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';

describe('OrdemPagamentoRepository.save (identificação pelo id do BigQuery)', () => {
  // O CustomLogger (usado pelo conversor) soma global.__localTzOffset ao timestamp; fora do
  // bootstrap da aplicação ele fica indefinido e o format() do date-fns estoura.
  beforeAll(() => {
    (global as any).__localTzOffset = (global as any).__localTzOffset ?? 0;
  });

  const build = () => {
    const typeormRepo = {
      findOneBy: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((e) => ({ id: 1000217, ...e })),
    };
    const dataSource = { query: jest.fn() };
    const repo = new OrdemPagamentoRepository(typeormRepo as any, dataSource as any);
    return { repo, typeormRepo, dataSource };
  };

  it('procura a ordem existente pelo bqId, nunca pelo id local', async () => {
    const { repo, typeormRepo } = build();
    typeormRepo.findOneBy.mockResolvedValue(null);

    await repo.save({ bqId: 999976, valor: 1327.5 });

    expect(typeormRepo.findOneBy).toHaveBeenCalledWith({ bqId: 999976 });
  });

  it('cria a ordem nova mesmo que o bqId coincida com o id local de uma ordem antiga', async () => {
    const { repo, typeormRepo } = build();
    // não existe nenhuma linha com bqId = 999976 (a de id 999976 tem bqId NULL)
    typeormRepo.findOneBy.mockResolvedValue(null);

    const salva = await repo.save({ bqId: 999976, valor: 1327.5 });

    expect(typeormRepo.save).toHaveBeenCalledTimes(1);
    expect(salva.id).toBe(1000217);
  });

  it('não duplica quando o bqId já foi sincronizado', async () => {
    const { repo, typeormRepo } = build();
    const existente = { id: 5, bqId: 999976 };
    typeormRepo.findOneBy.mockResolvedValue(existente);

    const resultado = await repo.save({ bqId: 999976 });

    expect(resultado).toBe(existente);
    expect(typeormRepo.save).not.toHaveBeenCalled();
  });

  it('converte BigQuery -> OrdemPagamento guardando o id do BigQuery em bqId e deixando o id para o banco', () => {
    const ordem = { id: 999976, dataOrdem: '2026-10-09', valorTotalTransacaoLiquido: 1327.5, datetimeUltimaAtualizacao: '2026-10-09 10:08:54' } as unknown as BigqueryOrdemPagamentoDTO;

    const entidade = BigQueryToOrdemPagamento.convert(ordem, 519);

    expect(entidade.bqId).toBe(999976);
    expect(entidade.id).toBeUndefined();
    expect(entidade.userId).toBe(519);
  });

  it('traduz ids locais em ids do BigQuery e ignora lista vazia', async () => {
    const { repo, dataSource } = build();
    dataSource.query.mockResolvedValue([{ bqId: '999976' }]);

    expect(await repo.findBqIdsByIds([1000217])).toEqual([999976]);
    expect(await repo.findBqIdsByIds([])).toEqual([]);
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });
});
