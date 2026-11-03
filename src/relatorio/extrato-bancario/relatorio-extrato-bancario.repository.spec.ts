import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioExtratoBancarioRepository } from './relatorio-extrato-bancario.repository';

describe('RelatorioExtratoBancarioRepository', () => {
  let dataSource: Pick<DataSource, 'createQueryRunner'>;
  let queryRunner: { connect: jest.Mock; query: jest.Mock; release: jest.Mock };
  let repository: RelatorioExtratoBancarioRepository;

  beforeEach(() => {
    jest.spyOn(CustomLogger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(CustomLogger.prototype, 'error').mockImplementation(() => undefined);

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
      release: jest.fn(),
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    repository = new RelatorioExtratoBancarioRepository(dataSource as DataSource);
  });

  function baseArgs() {
    return {
      dataInicio: new Date('2099-01-10'),
      dataFim: new Date('2099-01-05'),
      tipo: undefined as string | undefined,
      operacao: undefined as string[] | undefined,
      conta: undefined as string | undefined,
    };
  }

  it('rejeita quando dataFim é anterior a dataInicio', async () => {
    await expect(repository.findExtrato(baseArgs())).rejects.toThrow(/dataFim.*dataInicio/i);
  });

  it('não acessa o banco quando dataFim é anterior a dataInicio', async () => {
    await expect(repository.findExtrato(baseArgs())).rejects.toThrow();

    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('consulta normalmente quando dataInicio é igual a dataFim', async () => {
    const result = await repository.findExtrato({
      ...baseArgs(),
      dataInicio: new Date('2099-01-05'),
      dataFim: new Date('2099-01-05'),
    });

    expect(dataSource.createQueryRunner).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('consulta normalmente quando dataFim é posterior a dataInicio', async () => {
    const result = await repository.findExtrato({
      ...baseArgs(),
      dataInicio: new Date('2099-01-01'),
      dataFim: new Date('2099-01-31'),
    });

    expect(dataSource.createQueryRunner).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
