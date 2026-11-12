import { Test, TestingModule } from '@nestjs/testing';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { BasePagamentoRepository } from '../base/base-pagamento.repository';
import { StucGratuidadeRepository } from '../stuc-gratuidade/stuc-gratuidade.repository';
import { FinancialMovementV2SummaryService } from './financial-movement-v2-summary.service';

// T10 "Key design decision": no prior task built a service combining findGroupedRows/
// findEleicaoRows/StucGratuidadeRepository.findRows for Permissionario. These specs pin down
// the routing (stucGratuidade > eleicao > base, mirroring the legacy service's branch order)
// and the in-memory pagination used for the two sources that have no cursor (T7/T8).
describe('FinancialMovementV2SummaryService', () => {
  let service: FinancialMovementV2SummaryService;
  let basePagamentoRepository: BasePagamentoRepository;
  let stucGratuidadeRepository: StucGratuidadeRepository;

  const baseFilter = { dataInicio: new Date('2026-04-01'), dataFim: new Date('2026-04-22') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialMovementV2SummaryService,
        {
          provide: BasePagamentoRepository,
          useValue: { findGroupedRows: jest.fn().mockResolvedValue([]), findSummaryTotals: jest.fn().mockResolvedValue({ count: 0, valorTotal: 0 }), findGroupedRowsPage: jest.fn().mockResolvedValue({ rows: [], nextCursor: null }), findEleicaoRows: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: StucGratuidadeRepository,
          useValue: { findRows: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    service = module.get(FinancialMovementV2SummaryService);
    basePagamentoRepository = module.get(BasePagamentoRepository);
    stucGratuidadeRepository = module.get(StucGratuidadeRepository);
  });

  describe('findSummary', () => {
    it('routes Permissionario + stucGratuidade to StucGratuidadeRepository.findRows, never the base source', async () => {
      await service.findSummary('permissionario', { ...baseFilter, stucGratuidade: true });

      expect(stucGratuidadeRepository.findRows).toHaveBeenCalledWith(expect.objectContaining(baseFilter));
      expect(basePagamentoRepository.findSummaryTotals).not.toHaveBeenCalled();
      expect(basePagamentoRepository.findEleicaoRows).not.toHaveBeenCalled();
    });

    it('routes Permissionario + eleicao (without stucGratuidade) to findEleicaoRows, never the base source', async () => {
      await service.findSummary('permissionario', { ...baseFilter, eleicao: true });

      expect(basePagamentoRepository.findEleicaoRows).toHaveBeenCalledWith(expect.objectContaining(baseFilter));
      expect(basePagamentoRepository.findSummaryTotals).not.toHaveBeenCalled();
      expect(stucGratuidadeRepository.findRows).not.toHaveBeenCalled();
    });

    it('stucGratuidade takes priority over eleicao when both are set, same precedence as the legacy service/T9 export', async () => {
      await service.findSummary('permissionario', { ...baseFilter, eleicao: true, stucGratuidade: true });

      expect(stucGratuidadeRepository.findRows).toHaveBeenCalled();
      expect(basePagamentoRepository.findEleicaoRows).not.toHaveBeenCalled();
    });

    it('falls back to findSummaryTotals("permissionario", ...) when neither eleicao nor stucGratuidade is set', async () => {
      await service.findSummary('permissionario', baseFilter);

      expect(basePagamentoRepository.findSummaryTotals).toHaveBeenCalledWith('permissionario', expect.objectContaining(baseFilter));
    });

    it('never routes Guardador to Eleicao/STUC, even if those flags are set (they do not exist for that profile)', async () => {
      await service.findSummary('guardador', { ...baseFilter, eleicao: true, stucGratuidade: true } as any);

      expect(basePagamentoRepository.findSummaryTotals).toHaveBeenCalledWith('guardador', expect.anything());
      expect(basePagamentoRepository.findEleicaoRows).not.toHaveBeenCalled();
      expect(stucGratuidadeRepository.findRows).not.toHaveBeenCalled();
    });

    // ADR 0023 (T3): the base summary comes from the database totals, never from loading every row.
    it('returns the database totals for the base source without loading the rows', async () => {
      (basePagamentoRepository.findSummaryTotals as jest.Mock).mockResolvedValue({ count: 2, valorTotal: 15, valorPago: 10, valorAPagar: 5 });

      const summary = await service.findSummary('permissionario', baseFilter);

      expect(summary.count).toBe(2);
      expect(summary.valorTotal).toBe(15);
      expect(summary.valorPago).toBe(10);
      expect(summary.valorAPagar).toBe(5);
      expect(basePagamentoRepository.findGroupedRows).not.toHaveBeenCalled();
    });
  });

  describe('findPage', () => {
    it('paginates Eleicao in-memory (slice by page/pageSize), since findEleicaoRows has no cursor', async () => {
      (basePagamentoRepository.findEleicaoRows as jest.Mock).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({ dataReferencia: new Date('2026-04-01'), nomes: `N${i}`, cpfCnpj: `${i}`, nomeConsorcio: null, valor: '1.00', status: StatusPagamento.PAGO })),
      );

      const page1 = await service.findPage('permissionario', { ...baseFilter, eleicao: true, pageSize: 2, page: 1 });
      expect(page1.data).toHaveLength(2);
      expect(page1.nextCursor).toBe('2');

      const page3 = await service.findPage('permissionario', { ...baseFilter, eleicao: true, pageSize: 2, page: 3 });
      expect(page3.data).toHaveLength(1);
      expect(page3.nextCursor).toBeNull();

      expect(basePagamentoRepository.findGroupedRowsPage).not.toHaveBeenCalled();
    });

    it('paginates STUC-Gratuidade in-memory too', async () => {
      (stucGratuidadeRepository.findRows as jest.Mock).mockResolvedValue(
        Array.from({ length: 3 }, (_, i) => ({
          nomes: `N${i}`, cpfCnpj: `${i}`, nomeConsorcio: null, status: StatusPagamento.PAGO, valor: 1,
          dataOrdemPagamento1: null, valorOrdemPagamento1: null, dataOrdemPagamento2: null, valorOrdemPagamento2: null,
          dataOrdemPagamento3: null, valorOrdemPagamento3: null, dataOrdemPagamento4: null, valorOrdemPagamento4: null,
        })),
      );

      const page = await service.findPage('permissionario', { ...baseFilter, stucGratuidade: true, pageSize: 2, page: 1 });

      expect(page.data).toHaveLength(2);
      expect(page.nextCursor).toBe('2');
      expect(basePagamentoRepository.findGroupedRowsPage).not.toHaveBeenCalled();
    });

    it('uses the keyset cursor via findGroupedRowsPage for the base source', async () => {
      await service.findPage('permissionario', { ...baseFilter, pageSize: 10 });

      expect(basePagamentoRepository.findGroupedRowsPage).toHaveBeenCalledWith('permissionario', expect.objectContaining(baseFilter), 10, undefined);
    });

    // ADR 0023 (T4): the summary is computed once, on the first page (no cursor); later pages bring only rows.
    it('computes the summary on the first page (no cursor)', async () => {
      (basePagamentoRepository.findSummaryTotals as jest.Mock).mockResolvedValue({ count: 3, valorTotal: 30 });

      const page = await service.findPage('permissionario', baseFilter);

      expect(basePagamentoRepository.findSummaryTotals).toHaveBeenCalledWith('permissionario', expect.objectContaining(baseFilter));
      expect(page.count).toBe(3);
      expect(page.valorTotal).toBe(30);
    });

    it('skips the summary on later pages (with cursor) and leaves its fields out', async () => {
      const page = await service.findPage('guardador', { ...baseFilter, cursorDataReferencia: '2026-04-02', cursorStatus: 'Pago' });

      expect(basePagamentoRepository.findSummaryTotals).not.toHaveBeenCalled();
      expect(basePagamentoRepository.findGroupedRowsPage).toHaveBeenCalledWith('guardador', expect.anything(), 50, expect.objectContaining({ dataReferencia: '2026-04-02' }));
      expect(page).not.toHaveProperty('count');
      expect(page).not.toHaveProperty('valorTotal');
      expect(page).toEqual(expect.objectContaining({ currentPage: 1, pageSize: 50, data: [], nextCursor: null }));
    });

    it('defaults page/pageSize when not provided (edge case: minimal filter)', async () => {
      const page = await service.findPage('permissionario', baseFilter);

      expect(page.currentPage).toBe(1);
      expect(page.pageSize).toBe(50);
    });
  });
});
