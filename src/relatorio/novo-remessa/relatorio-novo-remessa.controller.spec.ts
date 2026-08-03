import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';
import { Test, TestingModule } from '@nestjs/testing';
import { RelatorioNovoRemessaFinancialMovementService } from '../movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { RelatorioNovoRemessaService } from './relatorio-novo-remessa.service';
import { RelatorioNovoRemessaController } from './relatorio-novo-remessa.controller';
import { FinancialMovementExportFormat } from '../dtos/financial-movement-export-request.dto';

describe('RelatorioNovoRemessaController', () => {
  let controller: RelatorioNovoRemessaController;
  let financialMovementService: RelatorioNovoRemessaFinancialMovementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelatorioNovoRemessaController],
      providers: [
        {
          provide: RelatorioNovoRemessaService,
          useValue: {},
        },
        {
          provide: RelatorioNovoRemessaFinancialMovementService,
          useValue: {
            downloadFinancialMovementExport: jest.fn(),
            removeGeneratedExportFile: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RelatorioNovoRemessaController>(RelatorioNovoRemessaController);
    financialMovementService = module.get<RelatorioNovoRemessaFinancialMovementService>(
      RelatorioNovoRemessaFinancialMovementService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the generated file through the download endpoint and cleans up temp storage', async () => {
    const exportDir = await mkdtemp(join(tmpdir(), 'financial-report-controller-spec-'));
    const filePath = join(exportDir, 'financial-report-2026-04-01-to-2026-04-22.csv');
    await writeFile(filePath, 'header1,header2\nvalue1,value2\n');

    const generatedFile = {
      filename: 'financial-report-2026-04-01-to-2026-04-22.csv',
      filePath,
      contentType: 'text/csv',
      compressed: false,
    };
    const response = new PassThrough() as PassThrough & {
      headersSent: boolean;
      setHeader: jest.Mock;
      status: jest.Mock;
      json: jest.Mock;
    };
    response.headersSent = false;
    response.setHeader = jest.fn();
    response.status = jest.fn().mockReturnThis();
    response.json = jest.fn();

    jest.spyOn(financialMovementService, 'downloadFinancialMovementExport').mockResolvedValue(generatedFile as any);
    jest.spyOn(financialMovementService, 'removeGeneratedExportFile').mockImplementation(async () => {
      await rm(generatedFile.filePath, { force: true });
      await rm(exportDir, { recursive: true, force: true });
    });

    await controller.downloadFinancialMovementReport(
      {
        format: FinancialMovementExportFormat.CSV,
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
      } as any,
      response as any,
    );

    expect(financialMovementService.downloadFinancialMovementExport).toHaveBeenCalledWith(
      expect.objectContaining({ format: FinancialMovementExportFormat.CSV }),
    );
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="${generatedFile.filename}"`,
    );
    expect(financialMovementService.removeGeneratedExportFile).toHaveBeenCalledWith(
      generatedFile.filePath,
    );
  });
});
