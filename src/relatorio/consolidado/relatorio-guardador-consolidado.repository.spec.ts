import { DataSource } from 'typeorm';
import { RelatorioGuardadorConsolidadoRepository } from './relatorio-guardador-consolidado.repository';

describe('RelatorioGuardadorConsolidadoRepository', () => {
  let repository: RelatorioGuardadorConsolidadoRepository;
  let dataSource: Pick<DataSource, 'createQueryRunner'>;
  let queryRunner: {
    connect: jest.Mock;
    query: jest.Mock;
    release: jest.Mock;
  };

  beforeEach(() => {
    (global as any).__localTzOffset = 0;

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ nome: 'Guardador 1', valor: 42.35 }]),
      release: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    repository = new RelatorioGuardadorConsolidadoRepository(
      dataSource as DataSource,
    );
  });

  it('should build a consolidated query without dangling AND when only valorMax is provided', async () => {
    await repository.findConsolidado({
      dataInicio: new Date('2026-08-01T00:00:00.000Z'),
      dataFim: new Date('2026-08-05T00:00:00.000Z'),
      pago: true,
      valorMax: 50,
    });

    const [query, params] = queryRunner.query.mock.calls[0];
    const normalizedQuery = query.toLowerCase();

    expect(normalizedQuery).toContain('group by r.nome having');
    expect(query).toContain('ROUND(SUM(r.valor)::numeric, 2) <= $');
    expect(normalizedQuery).not.toContain('and and');
    expect(normalizedQuery).not.toContain('group by r.nome and');
    expect(params.at(-1)).toBe(50);
  });

  it('should join valorMin and valorMax aggregate filters with HAVING', async () => {
    await repository.findConsolidado({
      dataInicio: new Date('2026-08-01T00:00:00.000Z'),
      dataFim: new Date('2026-08-05T00:00:00.000Z'),
      pago: true,
      valorMin: 10,
      valorMax: 20,
    });

    const [query, params] = queryRunner.query.mock.calls[0];
    const normalizedQuery = query.toLowerCase();

    expect(normalizedQuery).toContain('group by r.nome having');
    expect(query).toContain('ROUND(SUM(r.valor)::numeric, 2) >=');
    expect(query).toContain('AND ROUND(SUM(r.valor)::numeric, 2) <=');
    expect(params.slice(-2)).toEqual([10, 20]);
  });

  it('should omit HAVING when valorMin and valorMax are not provided', async () => {
    const result = await repository.findConsolidado({
      dataInicio: new Date('2026-08-01T00:00:00.000Z'),
      dataFim: new Date('2026-08-05T00:00:00.000Z'),
      pago: true,
    });

    const [query] = queryRunner.query.mock.calls[0];
    const normalizedQuery = query.toLowerCase();

    expect(normalizedQuery).toContain('group by r.nome');
    expect(normalizedQuery).not.toContain('having');
    expect(queryRunner.release).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
