import { DataSource, QueryRunner } from 'typeorm';
import { RelatorioNovoRemessaConsolidadoRepository } from './relatorio-novo-remessa-consolidado.repository';

describe('RelatorioNovoRemessaConsolidadoRepository', () => {
  let repository: RelatorioNovoRemessaConsolidadoRepository;
  let mockQueryRunner: Partial<QueryRunner>;
  let mockDataSource: Partial<DataSource>;

  // CustomLogger reads this global (set in main.ts) to format timestamps.
  beforeAll(() => {
    (global as any).__localTzOffset = 0;
  });

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner as QueryRunner),
    };

    repository = new RelatorioNovoRemessaConsolidadoRepository(mockDataSource as DataSource);
  });

  describe('findConsolidado - no status filter (default todosConsorcios/todosVanzeiros)', () => {
    it('does not union the consorcio status query with itself', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      const queryConsorciosFragment = (repository as any).getQueryConsorcios('2026-01-01', '2026-01-05');
      const occurrences = sql.split(queryConsorciosFragment).length - 1;

      expect(occurrences).toBe(1);
    });

    it('does not union the vanzeiro status query with itself', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      const queryVanzeirosFragment = (repository as any).getQueryVanzeiros('2026-01-01', '2026-01-05');
      const occurrences = sql.split(queryVanzeirosFragment).length - 1;

      expect(occurrences).toBe(1);
    });
  });

  describe('findConsolidado - valor total não duplica favorecido individual de STPC/STPL/TEC', () => {
    it('keeps both the consorcio and the vanzeiro rows, but sums the vanzeiro amount only once', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'STPC', valor: '100.00' },
        { nome: 'João Vanzeiro', valor: '40.00' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
      } as any);

      expect(result.data).toHaveLength(2);
      expect(result.valor).toBe(100);
    });

    it('sums both rows when the selected consorcio does not cover STPC/STPL/TEC', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'VLT', valor: '100.00' },
        { nome: 'João Vanzeiro', valor: '40.00' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        consorcioNome: ['VLT'],
        todosVanzeiros: true,
      } as any);

      expect(result.data).toHaveLength(2);
      expect(result.valor).toBe(140);
    });
  });

  describe('findConsolidado - STUC - Gratuidade', () => {
    it('reads valorGratuidade through the gratuidade grouping, filtered by userIds, with no bind placeholder left over', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        userIds: [10, 20],
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('op."valorGratuidade"');
      expect(sql).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
      expect(sql).toContain(`pu."id" IN('10','20')`);
      expect(sql).not.toMatch(/\$[1-5]\b/);
    });

    it('filters by MODAIS when todosVanzeiros is selected', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        todosVanzeiros: true,
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`op."nomeConsorcio" IN('STPC','STPL','TEC')`);
      expect(sql).toContain(`length(op."operadoraCpfCnpj")<=11`);
    });

    it('filters by a specific consorcio selection', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        consorcioNome: ['VLT'],
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`IN('VLT')`);
    });

    it('does not include any Eleicao/Pendentes marker', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        userIds: [10],
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).not.toContain('op."consorcio"');
      expect(sql).not.toContain('"ordemPagamentoAgrupadoId" is null');
    });
  });
});
