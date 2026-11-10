import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { RelatorioNovoRemessaV2Controller } from './relatorio-novo-remessa-v2.controller';
import { FinancialMovementV2SummaryService } from '../movimentacao-financeira-v2/summary/financial-movement-v2-summary.service';
import { FinancialMovementV2ExportService } from '../movimentacao-financeira-v2/export/financial-movement-v2-export.service';
import { RelatorioNovoRemessaFinancialMovementService } from '../movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { FinancialMovementExportFormat } from '../dtos/financial-movement-export-request.dto';
import { RolesGuard } from 'src/roles/roles.guard';
import { RoleEnum } from 'src/roles/roles.enum';

describe('RelatorioNovoRemessaV2Controller', () => {
  let controller: RelatorioNovoRemessaV2Controller;
  let summaryService: FinancialMovementV2SummaryService;
  let exportService: FinancialMovementV2ExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelatorioNovoRemessaV2Controller],
      providers: [
        {
          provide: FinancialMovementV2SummaryService,
          useValue: { findSummary: jest.fn(), findPage: jest.fn() },
        },
        {
          provide: RelatorioNovoRemessaFinancialMovementService,
          useValue: {
            findFinancialMovementSummary: jest.fn().mockResolvedValue({ count: 0 }),
            findFinancialMovementPage: jest.fn().mockResolvedValue({ count: 0, data: [] }),
            downloadFinancialMovementExport: jest.fn(),
          },
        },
        {
          provide: FinancialMovementV2ExportService,
          useValue: { downloadFinancialMovementExport: jest.fn(), removeGeneratedExportFile: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<RelatorioNovoRemessaV2Controller>(RelatorioNovoRemessaV2Controller);
    summaryService = module.get<FinancialMovementV2SummaryService>(FinancialMovementV2SummaryService);
    exportService = module.get<FinancialMovementV2ExportService>(FinancialMovementV2ExportService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const baseQuery = { dataInicio: new Date('2026-04-01'), dataFim: new Date('2026-04-22') } as any;

  // Behavior 1: Permissionario v2 routes call the right service method with mapped params.
  describe('Permissionario', () => {
    it('getFinancialMovementSummaryV2 calls findSummary("permissionario", ...) with mapped filter', async () => {
      jest.spyOn(summaryService, 'findSummary').mockResolvedValue({ count: 0 } as any);

      await controller.getFinancialMovementSummaryV2({ ...baseQuery, pago: true });

      expect(summaryService.findSummary).toHaveBeenCalledWith(
        'permissionario',
        expect.objectContaining({ dataInicio: baseQuery.dataInicio, dataFim: baseQuery.dataFim }),
      );
    });

    it('getFinancialMovementPageV2 calls findPage("permissionario", ...) with mapped filter', async () => {
      jest.spyOn(summaryService, 'findPage').mockResolvedValue({ data: [] } as any);

      await controller.getFinancialMovementPageV2({ ...baseQuery, page: 2, pageSize: 10 });

      expect(summaryService.findPage).toHaveBeenCalledWith(
        'permissionario',
        expect.objectContaining({ page: 2, pageSize: 10 }),
      );
    });

    it('downloadFinancialMovementReportV2 downloads via FinancialMovementV2ExportService("permissionario", ...) and cleans up', async () => {
      const exportDir = await mkdtemp(join(tmpdir(), 'financial-report-v2-controller-spec-'));
      const filePath = join(exportDir, 'financial-report-v2.csv');
      await writeFile(filePath, 'header1,header2\nvalue1,value2\n');

      const generatedFile = { filename: 'financial-report-v2.csv', filePath, contentType: 'text/csv', compressed: false };
      const response = new PassThrough() as PassThrough & { headersSent: boolean; setHeader: jest.Mock; status: jest.Mock; json: jest.Mock };
      response.headersSent = false;
      response.setHeader = jest.fn();
      response.status = jest.fn().mockReturnThis();
      response.json = jest.fn();

      jest.spyOn(exportService, 'downloadFinancialMovementExport').mockResolvedValue(generatedFile as any);
      jest.spyOn(exportService, 'removeGeneratedExportFile').mockImplementation(async () => {
        await rm(filePath, { force: true });
        await rm(exportDir, { recursive: true, force: true });
      });

      await controller.downloadFinancialMovementReportV2(
        { ...baseQuery, format: FinancialMovementExportFormat.CSV } as any,
        response as any,
      );

      expect(exportService.downloadFinancialMovementExport).toHaveBeenCalledWith(
        'permissionario',
        expect.objectContaining({ format: FinancialMovementExportFormat.CSV }),
      );
      expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', `attachment; filename="${generatedFile.filename}"`);
      expect(exportService.removeGeneratedExportFile).toHaveBeenCalledWith(generatedFile.filePath);
    });
  });

  // Behavior 2: the three Guardador equivalents.
  describe('Guardador', () => {
    it('getGuardadorFinancialMovementSummaryV2 calls findSummary("guardador", ...)', async () => {
      jest.spyOn(summaryService, 'findSummary').mockResolvedValue({ count: 0 } as any);

      await controller.getGuardadorFinancialMovementSummaryV2(baseQuery);

      expect(summaryService.findSummary).toHaveBeenCalledWith('guardador', expect.objectContaining({ dataInicio: baseQuery.dataInicio }));
    });

    it('getGuardadorFinancialMovementPageV2 calls findPage("guardador", ...)', async () => {
      jest.spyOn(summaryService, 'findPage').mockResolvedValue({ data: [] } as any);

      await controller.getGuardadorFinancialMovementPageV2(baseQuery);

      expect(summaryService.findPage).toHaveBeenCalledWith('guardador', expect.objectContaining({ dataInicio: baseQuery.dataInicio }));
    });

    it('downloadGuardadorFinancialMovementReportV2 downloads via FinancialMovementV2ExportService("guardador", ...) and cleans up', async () => {
      const exportDir = await mkdtemp(join(tmpdir(), 'financial-report-v2-guardador-controller-spec-'));
      const filePath = join(exportDir, 'financial-report-v2-guardador.csv');
      await writeFile(filePath, 'header1,header2\nvalue1,value2\n');

      const generatedFile = { filename: 'financial-report-v2-guardador.csv', filePath, contentType: 'text/csv', compressed: false };
      const response = new PassThrough() as PassThrough & { headersSent: boolean; setHeader: jest.Mock; status: jest.Mock; json: jest.Mock };
      response.headersSent = false;
      response.setHeader = jest.fn();
      response.status = jest.fn().mockReturnThis();
      response.json = jest.fn();

      jest.spyOn(exportService, 'downloadFinancialMovementExport').mockResolvedValue(generatedFile as any);
      jest.spyOn(exportService, 'removeGeneratedExportFile').mockImplementation(async () => {
        await rm(filePath, { force: true });
        await rm(exportDir, { recursive: true, force: true });
      });

      await controller.downloadGuardadorFinancialMovementReportV2(
        { ...baseQuery, format: FinancialMovementExportFormat.CSV } as any,
        response as any,
      );

      expect(exportService.downloadFinancialMovementExport).toHaveBeenCalledWith(
        'guardador',
        expect.objectContaining({ format: FinancialMovementExportFormat.CSV }),
      );
      expect(exportService.removeGeneratedExportFile).toHaveBeenCalledWith(generatedFile.filePath);
    });
  });

  // Edge case: no filter beyond the required dates - mapping must not throw.
  it('maps a query with only dataInicio/dataFim without throwing', async () => {
    jest.spyOn(summaryService, 'findSummary').mockResolvedValue({ count: 0 } as any);

    await expect(controller.getFinancialMovementSummaryV2(baseQuery)).resolves.toEqual({ count: 0 });
    expect(summaryService.findSummary).toHaveBeenCalledWith(
      'permissionario',
      expect.objectContaining({
        dataInicio: baseQuery.dataInicio,
        dataFim: baseQuery.dataFim,
        statuses: undefined,
        eleicao: undefined,
        stucGratuidade: undefined,
      }),
    );
  });

  // Behavior 3: auth/authorization guard present - same decorator as the legacy controller
  // (RelatorioNovoRemessaController: AuthGuard('jwt') on summary/page, + RolesGuard/Roles on
  // export/download). Same assertion style as consolidado-v2.controller.spec.ts.
  describe('Guards', () => {
    const summaryPageHandlers = [
      'getFinancialMovementSummaryV2',
      'getFinancialMovementPageV2',
      'getGuardadorFinancialMovementSummaryV2',
      'getGuardadorFinancialMovementPageV2',
    ] as const;

    it.each(summaryPageHandlers)('has a guard applied to %s (mirrors AuthGuard(jwt) on the legacy controller)', (handlerName) => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, (RelatorioNovoRemessaV2Controller.prototype as any)[handlerName]);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });

    const downloadHandlers = ['downloadFinancialMovementReportV2', 'downloadGuardadorFinancialMovementReportV2'] as const;

    it.each(downloadHandlers)('%s carries RolesGuard + Roles(master, admin), same as the legacy export/download routes', (handlerName) => {
      const handler = (RelatorioNovoRemessaV2Controller.prototype as any)[handlerName];
      const guards = Reflect.getMetadata(GUARDS_METADATA, handler);
      const roles = Reflect.getMetadata('roles', handler);
      expect(guards).toContain(RolesGuard);
      expect(roles).toEqual([RoleEnum.master, RoleEnum.admin]);
    });
  });
  it.each([[{ eleicao: true }], [{ stucGratuidade: true }]])('serves %j from the v1 implementation', async (flags) => {
    const legado = (controller as any).relatorioNovoRemessaFinancialMovementService;
    const query = { dataInicio: '2098-01-01', dataFim: '2098-01-31', ...flags } as any;

    await controller.getFinancialMovementSummaryV2(query);
    await controller.getFinancialMovementPageV2(query);

    expect(legado.findFinancialMovementSummary).toHaveBeenCalledWith(query);
    expect(legado.findFinancialMovementPage).toHaveBeenCalledWith(query);
    expect(summaryService.findSummary).not.toHaveBeenCalled();
  });
});
