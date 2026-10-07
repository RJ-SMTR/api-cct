import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import { RelatorioNovoRemessaFinancialMovementRepository } from './relatorio-novo-remessa-financial-movement.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './relatorio-novo-remessa-financial-movement.service';
import { RelatorioGuardadorFinancialMovementRepository } from './relatorio-guardador-financial-movement.repository';

describe('RelatorioNovoRemessaFinancialMovementService', () => {
  let service: RelatorioNovoRemessaFinancialMovementService;
  let guardadorRepo: RelatorioGuardadorFinancialMovementRepository;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatorioNovoRemessaFinancialMovementService,
        {
          provide: getDataSourceToken(),
          useValue: { query: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { query: jest.fn() },
        },
        {
          provide: RelatorioGuardadorFinancialMovementRepository,
          useValue: {
            findFinancialMovementSummary: jest.fn(),
            findFinancialMovementPage: jest.fn(),
            streamFinancialMovementRows: jest.fn(),
          },
        },
        {
          provide: RelatorioNovoRemessaFinancialMovementRepository,
          useValue: {
            findFinancialMovementSummary: jest.fn(),
            findFinancialMovementPage: jest.fn(),
            streamFinancialMovementRows: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RelatorioNovoRemessaFinancialMovementService>(
      RelatorioNovoRemessaFinancialMovementService,
    );
    guardadorRepo = module.get<RelatorioGuardadorFinancialMovementRepository>(
      RelatorioGuardadorFinancialMovementRepository,
    );
    dataSource = module.get(getDataSourceToken());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a direct-download export file for permissionarios', async () => {
    jest.spyOn(service, 'streamFinancialMovementRows').mockImplementation(async (filter, onRow) => {
      await onRow({
        dataReferencia: '01/01/2026',
        dataPagamento: '05/01/2026',
        nomes: 'TESTE',
        email: 'teste@email.com',
        codBanco: '001',
        nomeBanco: 'BB',
        cpfCnpj: '123',
        consorcio: 'STPC',
        valor: 100,
        status: 'Rejeitado',
        descricaoErro: 'Agência/Conta corrente/DV inválido',
      } as any);
    });

    const response = await service.downloadFinancialMovementExport({
      dataInicio: new Date('2026-04-01'),
      dataFim: new Date('2026-04-22'),
    } as any);

    expect(response.contentType).toBe('text/csv; charset=utf-8');
    expect(response.filename).toContain('financial-movement-');
    expect(fs.existsSync(response.filePath)).toBe(true);

    const [header, line] = fs.readFileSync(response.filePath, 'utf8').trim().split('\n');
    expect(header.endsWith(';status;descricaoErro')).toBe(true);
    expect(line.endsWith(';Rejeitado;"Agência/Conta corrente/DV inválido"')).toBe(true);

    await service.removeGeneratedExportFile(response.filePath);
  });

  it('generates a direct-download export file for guardadores', async () => {
    jest
      .spyOn(guardadorRepo, 'streamFinancialMovementRows')
      .mockImplementation(async (filter, onRow) => {
        await onRow({
          dataReferencia: '01/01/2026',
          dataPagamento: '05/01/2026',
          nomes: 'GUARDADOR TESTE',
          email: 'g@email.com',
          codBanco: '001',
          nomeBanco: 'BB',
          cpfCnpj: '456',
          consorcio: 'Guardador Autônomo',
          valor: 200,
          status: 'Pago',
        } as any);
      });

    const response = await service.downloadGuardadorFinancialMovementExport({
      dataInicio: new Date('2026-04-01'),
      dataFim: new Date('2026-04-22'),
    } as any);

    expect(response.contentType).toBe('text/csv; charset=utf-8');
    expect(response.filename).toContain('financial-movement-guardadores-');
    expect(fs.existsSync(response.filePath)).toBe(true);

    // A row without an error keeps the description empty, so the column stays aligned.
    const [header, line] = fs.readFileSync(response.filePath, 'utf8').trim().split('\n');
    expect(header.endsWith(';status;descricaoErro')).toBe(true);
    expect(line.endsWith(';Pago;""')).toBe(true);

    await service.removeGeneratedExportFile(response.filePath);
  });

  describe('Pendencia Paga status filter', () => {
    // Trecho exclusivo da sub-consulta de Pendencia Paga (buildPendenciaPagaSingleDateQuery):
    // filtra pela data de pagamento da própria OPA, não da "pai".
    const PENDENCIA_PAGA_MARKER = 'opa."dataPagamento"::date BETWEEN $1::date AND $2::date';

    it('includes Pendencia Paga filtered by payment date even over a multi-day range', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
        pendenciaPaga: true,
        pago: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(PENDENCIA_PAGA_MARKER);
    });

    it('keeps including Pendencia Paga when the range is a single day (no regression)', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-01'),
        pendenciaPaga: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(PENDENCIA_PAGA_MARKER);
    });

    it('does not include Pendencia Paga when it was not selected', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
        pago: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).not.toContain(PENDENCIA_PAGA_MARKER);
    });

    it('still requires a single day for Estorno/Rejeitado while Pendencia Paga uses the full range', async () => {
      // Alias exclusivo de buildPendenciaPagamentoSingleDateQuery (join com o histórico mais recente da "pai").
      const PENDENCIA_PAGAMENTO_MARKER = 'oph_pai';

      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
        pendenciaPaga: true,
        estorno: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(PENDENCIA_PAGA_MARKER);
      expect(countQuery).not.toContain(PENDENCIA_PAGAMENTO_MARKER);
    });
  });
});
