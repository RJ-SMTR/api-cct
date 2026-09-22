import { DataSource, QueryRunner } from 'typeorm';
import { RelatorioNovoRemessaMovimentacaoRepository } from './relatorio-novo-remessa-movimentacao.repository';

describe('RelatorioNovoRemessaMovimentacaoRepository — STPC/STPL/TEC grouping', () => {
  let repository: RelatorioNovoRemessaMovimentacaoRepository;
  let mockQueryRunner: Partial<QueryRunner>;
  let mockDataSource: Partial<DataSource>;

  beforeAll(() => {
    (global as any).__localTzOffset = 0;
  });

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ total: '0' }]),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner as QueryRunner),
    };

    repository = new RelatorioNovoRemessaMovimentacaoRepository(mockDataSource as DataSource);
  });

  // A modal (STPC/STPL/TEC) is derived from permitCode, not a real "nomeConsorcio" — the boss
  // wants one row per date/status with the sum of every vanzeiro of that modal, not one row
  // per vanzeiro.
  it('groups by date and status, summing valor, when a single modal is selected', async () => {
    (mockQueryRunner.query as jest.Mock)
      .mockResolvedValueOnce([{ total: '0' }])
      .mockResolvedValueOnce([]);

    await repository.findMovimentacao({
      dataInicio: new Date('2026-07-01'),
      dataFim: new Date('2026-09-22'),
      consorcioNome: ['STPC'],
      pago: true,
    } as any);

    const [, dataQuery] = (mockQueryRunner.query as jest.Mock).mock.calls.map((call) => call[0]);

    expect(dataQuery).toContain('GROUP BY "dataReferencia", consorcio, status');
    expect(dataQuery).toContain('SUM(valor) AS valor');
    expect(dataQuery).toContain('consorcio AS nomes');
  });

  it('counts distinct date/consorcio/status groups instead of raw rows when grouped', async () => {
    await repository.findMovimentacao({
      dataInicio: new Date('2026-07-01'),
      dataFim: new Date('2026-09-22'),
      consorcioNome: ['STPC'],
      pago: true,
    } as any);

    const [aggQuery] = (mockQueryRunner.query as jest.Mock).mock.calls.map((call) => call[0]);

    expect(aggQuery).toContain('COUNT(DISTINCT ("dataReferencia", consorcio, status)) AS total');
  });

  // STPC/STPL/TEC are derived from pu."permitCode", but op."nomeConsorcio" (what the old
  // filter matched against) disagrees with that derivation for ~0.6% of rows in production —
  // matching permitCode keeps what is filtered consistent with what is grouped/labeled.
  it('filters by the permitCode-derived modal instead of the raw nomeConsorcio column', async () => {
    await repository.findMovimentacao({
      dataInicio: new Date('2026-07-01'),
      dataFim: new Date('2026-09-22'),
      consorcioNome: ['STPC'],
      pago: true,
    } as any);

    const [aggQuery] = (mockQueryRunner.query as jest.Mock).mock.calls.map((call) => call[0]);

    expect(aggQuery).toContain(`pu."permitCode" LIKE '4%'`);
    expect(aggQuery).not.toContain(`op."nomeConsorcio" IN('STPC')`);
  });

  it('matches every selected modal when more than one of STPC/STPL/TEC is chosen', async () => {
    await repository.findMovimentacao({
      dataInicio: new Date('2026-07-01'),
      dataFim: new Date('2026-09-22'),
      consorcioNome: ['STPC', 'TEC'],
      pago: true,
    } as any);

    const [aggQuery] = (mockQueryRunner.query as jest.Mock).mock.calls.map((call) => call[0]);

    expect(aggQuery).toContain(`pu."permitCode" LIKE '4%'`);
    expect(aggQuery).toContain(`pu."permitCode" LIKE '7%'`);
  });

  // Mixing a modal with a real consórcio, or selecting a real consórcio alone, keeps the
  // existing per-vanzeiro behavior untouched — only a pure STPC/STPL/TEC selection groups.
  it('does not group when a real consórcio is selected together with a modal', async () => {
    await repository.findMovimentacao({
      dataInicio: new Date('2026-07-01'),
      dataFim: new Date('2026-09-22'),
      consorcioNome: ['STPC', 'Internorte'],
      pago: true,
    } as any);

    const [aggQuery, dataQuery] = (mockQueryRunner.query as jest.Mock).mock.calls.map((call) => call[0]);

    expect(aggQuery).toContain('COUNT(*) AS total');
    expect(dataQuery).not.toContain('GROUP BY "dataReferencia", consorcio, status');
    expect(dataQuery).toContain(`op."nomeConsorcio" IN('STPC','Internorte')`);
  });

  it('does not group when a single real consórcio is selected', async () => {
    await repository.findMovimentacao({
      dataInicio: new Date('2026-07-01'),
      dataFim: new Date('2026-09-22'),
      consorcioNome: ['Internorte'],
      pago: true,
    } as any);

    const [aggQuery, dataQuery] = (mockQueryRunner.query as jest.Mock).mock.calls.map((call) => call[0]);

    expect(aggQuery).toContain('COUNT(*) AS total');
    expect(dataQuery).toContain(`op."nomeConsorcio" IN('Internorte')`);
  });
});
