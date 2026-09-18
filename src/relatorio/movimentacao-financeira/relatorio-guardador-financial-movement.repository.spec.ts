import { DataSource, QueryRunner } from 'typeorm';
import { RelatorioGuardadorFinancialMovementRepository } from './relatorio-guardador-financial-movement.repository';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';

describe('RelatorioGuardadorFinancialMovementRepository', () => {
  let repository: RelatorioGuardadorFinancialMovementRepository;
  let mockQueryRunner: Partial<QueryRunner>;
  let mockDataSource: Partial<DataSource>;

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner as QueryRunner),
    };

    repository = new RelatorioGuardadorFinancialMovementRepository(
      mockDataSource as DataSource,
    );
  });

  describe('findFinancialMovementSummary', () => {
    it('should query count and aggregates and return RelatorioFinancialMovementNovoRemessaSummaryDto', async () => {
      (mockQueryRunner.query as jest.Mock)
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce([
          {
            valorTotal: '5000.50',
            valorPago: '3000.00',
            valorEstornado: '500.00',
            valorRejeitado: '500.50',
            valorAguardandoPagamento: '500.00',
            valorAPagar: '500.00',
            valorPendente: '0',
            valorPendenciaPaga: '0',
          },
        ]);

      const result = await repository.findFinancialMovementSummary({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        consorcioNome: ['SINGAERJ'],
        pago: true,
      });

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result.count).toBe(10);
      expect(result.valorTotal).toBe(5000.50);
      expect(result.valorPago).toBe(3000.00);
      expect(result.valorEstornado).toBe(500.00);
      expect(result.valorRejeitado).toBe(500.50);
    });
  });

  describe('findFinancialMovementPage', () => {
    it('should query page data with pagination and return RelatorioFinancialMovementNovoRemessaPageDto', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValueOnce([
        {
          dataReferencia: '01/01/2026',
          dataPagamento: '05/01/2026',
          nomes: 'GUARDADOR TESTE',
          email: 'guardador@email.com',
          codBanco: '001',
          nomeBanco: 'BANCO DO BRASIL',
          cpfCnpj: '12345678900',
          consorcio: 'Guardador Autônomo',
          valor: 150.50,
          status: 'Pago',
        },
      ]);

      const result = await repository.findFinancialMovementPage({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        page: 1,
        pageSize: 50,
      });

      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].nomes).toBe('GUARDADOR TESTE');
      expect(result.data[0].status).toBe('Pago');
      expect(result.nextCursor).toEqual({
        dataReferencia: '01/01/2026',
        nomes: 'GUARDADOR TESTE',
        status: 'Pago',
        cpfCnpj: '12345678900',
      });
    });
  });

  describe('streamFinancialMovementRows', () => {
    it('should stream rows in batches and call onRow for each record', async () => {
      (mockQueryRunner.query as jest.Mock)
        .mockResolvedValueOnce([
          {
            dataReferencia: '01/01/2026',
            dataPagamento: '05/01/2026',
            nomes: 'GUARDADOR 1',
            email: 'g1@email.com',
            codBanco: '001',
            nomeBanco: 'BB',
            cpfCnpj: '111',
            consorcio: 'Guardador Autônomo',
            valor: 100,
            status: 'Pago',
          },
        ]);

      const rowsProcessed: string[] = [];
      await repository.streamFinancialMovementRows(
        {
          dataInicio: new Date('2026-01-01'),
          dataFim: new Date('2026-01-05'),
        },
        (row) => {
          rowsProcessed.push(row.nomes);
        },
      );

      expect(rowsProcessed).toEqual(['GUARDADOR 1']);
    });
  });
});
