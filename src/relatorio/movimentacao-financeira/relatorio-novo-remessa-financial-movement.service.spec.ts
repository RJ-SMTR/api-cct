import { Test, TestingModule } from '@nestjs/testing';
import { RelatorioNovoRemessaFinancialMovementRepository } from './relatorio-novo-remessa-financial-movement.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './relatorio-novo-remessa-financial-movement.service';
import { FinancialMovementExportFormat } from '../dtos/financial-movement-export-request.dto';

describe('RelatorioNovoRemessaFinancialMovementService', () => {
  let service: RelatorioNovoRemessaFinancialMovementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatorioNovoRemessaFinancialMovementService,
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a direct-download export file without using email delivery', async () => {
    const summary = { count: 1, data: [] };
    const generatedFile = {
      filename: 'relatorio-financeiro-2026-04-01-a-2026-04-22.csv',
      filePath: '/tmp/financial-report.csv',
      contentType: 'text/csv',
      compressed: false,
    };

    jest.spyOn(service, 'findFinancialMovementSummary').mockResolvedValue(summary as any);
    const generateExportFileSpy = jest
      .spyOn(service as any, 'generateExportFile')
      .mockResolvedValue(generatedFile);

    const response = await service.downloadFinancialMovementExport({
      format: FinancialMovementExportFormat.CSV,
      dataInicio: new Date('2026-04-01'),
      dataFim: new Date('2026-04-22'),
    } as any);

    expect(response).toEqual(generatedFile);
    expect(generateExportFileSpy).toHaveBeenCalledWith(
      expect.objectContaining({ format: FinancialMovementExportFormat.CSV }),
      summary,
    );
  });
});
