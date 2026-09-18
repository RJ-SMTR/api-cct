import { DataSource, QueryRunner } from 'typeorm';
import { RelatorioGuardadorConsolidadoRepository } from './relatorio-guardador-consolidado.repository';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';

describe('RelatorioGuardadorConsolidadoRepository', () => {
  let repository: RelatorioGuardadorConsolidadoRepository;
  let mockQueryRunner: Partial<QueryRunner>;
  let mockDataSource: Partial<DataSource>;

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([
        { nome: 'GUARDADOR TESTE', valor: '150.50' },
        { nome: 'GUARDADOR TESTE 2', valor: '200.00' },
      ]),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner as QueryRunner),
    };

    repository = new RelatorioGuardadorConsolidadoRepository(
      mockDataSource as DataSource,
    );
  });

  describe('getSelectedStatuses and resolveStatuses', () => {
    it('should resolve "todos" status to include all base statuses and aPagar', () => {
      const selected = (repository as any).getSelectedStatuses({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-01'),
        status: 'todos',
      });
      expect(selected).toEqual([]);

      const resolved = (repository as any).resolveStatuses(selected, true);
      expect(resolved).toEqual({
        baseStatuses: null,
        includeAPagar: true,
        includeBase: true,
        includePendenciaPagaSingleDate: false,
      });
    });

    it('should resolve "pago" status correctly', () => {
      const selected = (repository as any).getSelectedStatuses({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-01'),
        status: 'pago',
      });
      expect(selected).toEqual([StatusPagamento.PAGO]);

      const resolved = (repository as any).resolveStatuses(selected, true);
      expect(resolved).toEqual({
        baseStatuses: [StatusPagamento.PAGO],
        includeAPagar: false,
        includeBase: true,
        includePendenciaPagaSingleDate: false,
      });
    });

    it('should resolve "aPagar" status correctly', () => {
      const selected = (repository as any).getSelectedStatuses({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-01'),
        status: 'aPagar',
      });
      expect(selected).toEqual([StatusPagamento.A_PAGAR]);

      const resolved = (repository as any).resolveStatuses(selected, true);
      expect(resolved).toEqual({
        baseStatuses: [StatusPagamento.A_PAGAR],
        includeAPagar: true,
        includeBase: true,
        includePendenciaPagaSingleDate: false,
      });
    });

    it('should resolve "erros" status to Estorno and Rejeitado', () => {
      const selected = (repository as any).getSelectedStatuses({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-01'),
        status: 'erros',
      });
      expect(selected).toEqual([StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO]);

      const resolved = (repository as any).resolveStatuses(selected, true);
      expect(resolved).toEqual({
        baseStatuses: [StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO],
        includeAPagar: false,
        includeBase: true,
        includePendenciaPagaSingleDate: false,
      });
    });

    it('should resolve specific boolean flags when status is not passed', () => {
      const selected = (repository as any).getSelectedStatuses({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-01'),
        estorno: true,
      });
      expect(selected).toEqual([StatusPagamento.ERRO_ESTORNO]);

      const resolved = (repository as any).resolveStatuses(selected, false);
      expect(resolved).toEqual({
        baseStatuses: [StatusPagamento.ERRO_ESTORNO],
        includeAPagar: false,
        includeBase: true,
        includePendenciaPagaSingleDate: false,
      });
    });

    it('should resolve pendenciaPaga on single date using single date query', () => {
      const selected = (repository as any).getSelectedStatuses({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-01'),
        pendenciaPaga: true,
      });
      expect(selected).toEqual([StatusPagamento.PENDENCIA_PAGA]);

      const resolved = (repository as any).resolveStatuses(selected, true);
      expect(resolved).toEqual({
        baseStatuses: null,
        includeAPagar: false,
        includeBase: false,
        includePendenciaPagaSingleDate: true,
      });
    });

    it('should resolve pendenciaPaga on date range as a base status', () => {
      const selected = (repository as any).getSelectedStatuses({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-10'),
        pendenciaPaga: true,
      });
      expect(selected).toEqual([StatusPagamento.PENDENCIA_PAGA]);

      const resolved = (repository as any).resolveStatuses(selected, false);
      expect(resolved).toEqual({
        baseStatuses: [StatusPagamento.PENDENCIA_PAGA],
        includeAPagar: false,
        includeBase: true,
        includePendenciaPagaSingleDate: false,
      });
    });
  });

  describe('findConsolidado', () => {
    it('should execute consolidated query and return mapped RelatorioConsolidadoDto list', async () => {
      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        consorcioNome: ['SINGAERJ'],
        valorMin: 50,
        valorMax: 500,
      });

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY nomes'),
        [
          '2026-01-01',
          '2026-01-05',
          null,
          null,
          ['SINGAERJ'],
          50,
          500,
          null,
        ],
      );

      expect(result).toHaveLength(2);
      expect(result[0].nome).toBe('GUARDADOR TESTE');
      expect(result[0].valor).toBe(150.50);
      expect(result[1].nome).toBe('GUARDADOR TESTE 2');
      expect(result[1].valor).toBe(200.00);
    });

    it('should ignore "Todos" in consorcioNome and favorecidoNome', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-01'),
        consorcioNome: ['Todos'],
        favorecidoNome: ['Todos'],
      });

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.any(String),
        [
          '2026-01-01',
          '2026-01-01',
          null,
          null,
          null,
          null,
          null,
          null,
        ],
      );
    });
  });

  describe('findConsolidadoNovoRemessa', () => {
    it('should return RelatorioConsolidadoNovoRemessaDto with count, total valor and mapped data', async () => {
      const result = await repository.findConsolidadoNovoRemessa({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
      });

      expect(result.count).toBe(2);
      expect(result.valor).toBe(350.50);
      expect(result.data[0].nomefavorecido).toBe('GUARDADOR TESTE');
      expect(result.data[0].valor).toBe(150.50);
      expect(result.data[1].nomefavorecido).toBe('GUARDADOR TESTE 2');
      expect(result.data[1].valor).toBe(200.00);
    });
  });
});
