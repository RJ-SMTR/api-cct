import { Injectable } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import * as xlsx from 'xlsx';
import { FinancialMovementExportFormat, FinancialMovementExportRequestDto } from '../dtos/financial-movement-export-request.dto';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { RelatorioNovoRemessaFinancialMovementRepository } from './relatorio-novo-remessa-financial-movement.repository';
import { RelatorioGuardadorFinancialMovementRepository } from './relatorio-guardador-financial-movement.repository';
import {
  buildExportBaseFilename,
  EXPORT_COLUMNS_PT_BR,
  buildSelectedStatusLabels,
  buildSummaryLines,
  csvEscape,
  formatFileDate,
  toPdfSafeText,
  toExportRow,
  truncateText,
} from './financial-movement-export.utils';
import { buildSimplePdf } from './simple-pdf';

type GeneratedExportFile = {
  contentType: string;
  filename: string;
  filePath: string;
  compressed: false;
};

@Injectable()
export class RelatorioNovoRemessaFinancialMovementService {
  constructor(
    private readonly relatorioNovoRemessaFinancialMovementRepository: RelatorioNovoRemessaFinancialMovementRepository,
    private readonly relatorioGuardadorFinancialMovementRepository: RelatorioGuardadorFinancialMovementRepository,
  ) { }

  /**
   * Gerar relatórios payandpending - agrupados por Favorecido.
   */
  async findFinancialMovementSummary(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    this.ensureValidDateRange(args);
    return this.relatorioNovoRemessaFinancialMovementRepository.findFinancialMovementSummary(args);
  }

  async findFinancialMovementPage(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    this.ensureValidDateRange(args);
    return this.relatorioNovoRemessaFinancialMovementRepository.findFinancialMovementPage(args);
  }

  async downloadFinancialMovementExport(
    args: FinancialMovementExportRequestDto,
  ): Promise<GeneratedExportFile> {
    this.ensureValidDateRange(args);
    const summary = await this.findFinancialMovementSummary(args);
    return this.generateExportFile(args, summary, false);
  }

  async findGuardadorFinancialMovementSummary(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    this.ensureValidDateRange(args);
    return this.relatorioGuardadorFinancialMovementRepository.findFinancialMovementSummary(args);
  }

  async findGuardadorFinancialMovementPage(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    this.ensureValidDateRange(args);
    return this.relatorioGuardadorFinancialMovementRepository.findFinancialMovementPage(args);
  }

  async downloadGuardadorFinancialMovementExport(
    args: FinancialMovementExportRequestDto,
  ): Promise<GeneratedExportFile> {
    this.ensureValidDateRange(args);
    const summary = await this.findGuardadorFinancialMovementSummary(args);
    return this.generateExportFile(args, summary, true);
  }

  private ensureValidDateRange(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    if (args.dataInicio === undefined || args.dataFim === undefined ||
      new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }
  }

  private async generateExportFile(
    args: FinancialMovementExportRequestDto,
    summary: Awaited<ReturnType<RelatorioNovoRemessaFinancialMovementService['findFinancialMovementSummary']>>,
    isGuardador = false,
  ): Promise<GeneratedExportFile> {
    switch (args.format) {
      case FinancialMovementExportFormat.CSV:
        return this.generateCsvExport(args, summary, isGuardador);
      case FinancialMovementExportFormat.XLSX:
        return this.generateXlsxExport(args, summary, isGuardador);
      case FinancialMovementExportFormat.PDF:
        return this.generatePdfExport(args, summary, isGuardador);
      default:
        throw new Error(`Formato não suportado: ${args.format}`);
    }
  }

  private async createExportDir(): Promise<string> {
    const exportDir = join(tmpdir(), `financial-report-${Date.now()}-${Math.round(Math.random() * 10000)}`);
    await mkdir(exportDir, { recursive: true });
    return exportDir;
  }

  async removeGeneratedExportFile(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
    await rm(dirname(filePath), { recursive: true, force: true });
  }

  private async writeChunk(stream: PassThrough, chunk: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      stream.write(chunk, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private buildCsvHeaderLines(
    args: FinancialMovementExportRequestDto,
    summary: Awaited<ReturnType<RelatorioNovoRemessaFinancialMovementService['findFinancialMovementSummary']>>,
  ): string[] {
    const selectedStatuses = buildSelectedStatusLabels(args);
    const summaryLines = buildSummaryLines(summary);

    return [
      `Período do Relatório,${csvEscape(`${formatFileDate(new Date(args.dataInicio))} a ${formatFileDate(new Date(args.dataFim))}`)}`,
      `Status Selecionados,${csvEscape(selectedStatuses.length ? selectedStatuses.join(', ') : 'Todos')}`,
      EXPORT_COLUMNS_PT_BR.map(csvEscape).join(','),
      ...summaryLines.map(([label, value]) => `Resumo,${csvEscape(label)},${csvEscape(value)}`),
      '',
      EXPORT_COLUMNS_PT_BR.map(csvEscape).join(','),
    ];
  }

  private async generateCsvExport(
    args: FinancialMovementExportRequestDto,
    summary: Awaited<ReturnType<RelatorioNovoRemessaFinancialMovementService['findFinancialMovementSummary']>>,
    isGuardador = false,
  ): Promise<GeneratedExportFile> {
    const exportDir = await this.createExportDir();
    const baseFilename = buildExportBaseFilename(
      FinancialMovementExportFormat.CSV,
      new Date(args.dataInicio),
      new Date(args.dataFim),
    );
    const filename = isGuardador ? `guardadores-${baseFilename}` : baseFilename;
    const filePath = join(exportDir, filename);

    const input = new PassThrough();
    const output = createWriteStream(filePath);
    const pipelinePromise = pipeline(input, output);

    for (const line of this.buildCsvHeaderLines(args, summary)) {
      await this.writeChunk(input, `${line}\n`);
    }

    const repository = isGuardador
      ? this.relatorioGuardadorFinancialMovementRepository
      : this.relatorioNovoRemessaFinancialMovementRepository;

    await repository.streamFinancialMovementRows(args, async (row) => {
      const exportRow = toExportRow(row);
      const line = [
        exportRow.dataReferencia,
        exportRow.dataPagamento,
        exportRow.nomes,
        exportRow.email,
        exportRow.codBanco,
        exportRow.nomeBanco,
        exportRow.cpfCnpj,
        exportRow.consorcio,
        exportRow.valor,
        exportRow.status,
      ].map(csvEscape).join(',');
      await this.writeChunk(input, `${line}\n`);
    });

    input.end();
    await pipelinePromise;

    return {
      filename,
      filePath,
      compressed: false,
      contentType: 'text/csv',
    };
  }

  private async generateXlsxExport(
    args: FinancialMovementExportRequestDto,
    summary: Awaited<ReturnType<RelatorioNovoRemessaFinancialMovementService['findFinancialMovementSummary']>>,
    isGuardador = false,
  ): Promise<GeneratedExportFile> {
    const exportDir = await this.createExportDir();
    const baseFilename = buildExportBaseFilename(
      FinancialMovementExportFormat.XLSX,
      new Date(args.dataInicio),
      new Date(args.dataFim),
    );
    const filename = isGuardador ? `guardadores-${baseFilename}` : baseFilename;
    const filePath = join(exportDir, filename);
    const metadataRows: Array<Array<string>> = [
      ['Período', `${formatFileDate(new Date(args.dataInicio))} a ${formatFileDate(new Date(args.dataFim))}`],
      ['Status Selecionados', buildSelectedStatusLabels(args).join(', ') || 'Todos'],
      ...buildSummaryLines(summary),
    ];
    const dataRows: Array<Array<string>> = [Array.from(EXPORT_COLUMNS_PT_BR)];

    const repository = isGuardador
      ? this.relatorioGuardadorFinancialMovementRepository
      : this.relatorioNovoRemessaFinancialMovementRepository;

    await repository.streamFinancialMovementRows(args, async (row) => {
      const exportRow = toExportRow(row);
      dataRows.push([
        exportRow.dataReferencia,
        exportRow.dataPagamento,
        exportRow.nomes,
        exportRow.email,
        exportRow.codBanco,
        exportRow.nomeBanco,
        exportRow.cpfCnpj,
        exportRow.consorcio,
        exportRow.valor,
        exportRow.status,
      ]);
    });

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(metadataRows), 'Resumo');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(dataRows), 'Dados');
    xlsx.writeFile(workbook, filePath);

    return {
      filename,
      filePath,
      compressed: false,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private async generatePdfExport(
    args: FinancialMovementExportRequestDto,
    summary: Awaited<ReturnType<RelatorioNovoRemessaFinancialMovementService['findFinancialMovementSummary']>>,
    isGuardador = false,
  ): Promise<GeneratedExportFile> {
    const exportDir = await this.createExportDir();
    const baseFilename = buildExportBaseFilename(
      FinancialMovementExportFormat.PDF,
      new Date(args.dataInicio),
      new Date(args.dataFim),
    );
    const filename = isGuardador ? `guardadores-${baseFilename}` : baseFilename;
    const filePath = join(exportDir, filename);
    const lines: string[] = [
      'Relatorio Financeiro Guardadores',
      `Periodo: ${formatFileDate(new Date(args.dataInicio))} a ${formatFileDate(new Date(args.dataFim))}`,
      `Status Selecionados: ${toPdfSafeText(buildSelectedStatusLabels(args).join(', ') || 'Todos')}`,
      '',
      'Dt. Ref. | Dt. Pgto | Nome | Email | Cod. | Banco | CPF/CNPJ | Associacao | Valor | Status',
    ];

    const repository = isGuardador
      ? this.relatorioGuardadorFinancialMovementRepository
      : this.relatorioNovoRemessaFinancialMovementRepository;

    await repository.streamFinancialMovementRows(args, async (row) => {
      const exportRow = toExportRow(row);
      lines.push([
        truncateText(toPdfSafeText(exportRow.dataReferencia), 10),
        truncateText(toPdfSafeText(exportRow.dataPagamento), 10),
        truncateText(toPdfSafeText(exportRow.nomes), 24),
        truncateText(toPdfSafeText(exportRow.email), 28),
        truncateText(toPdfSafeText(exportRow.codBanco), 5),
        truncateText(toPdfSafeText(exportRow.nomeBanco), 16),
        truncateText(toPdfSafeText(exportRow.cpfCnpj), 18),
        truncateText(toPdfSafeText(exportRow.consorcio), 14),
        truncateText(toPdfSafeText(exportRow.valor), 16),
        truncateText(toPdfSafeText(exportRow.status), 16),
      ].join(' | '));
    });

    lines.push('', 'Resumo');
    for (const [label, value] of buildSummaryLines(summary)) {
      lines.push(`${toPdfSafeText(label)}: ${toPdfSafeText(value)}`);
    }

    const linesPerPage = 40;
    const pages: string[][] = [];
    for (let index = 0; index < lines.length; index += linesPerPage) {
      pages.push(lines.slice(index, index + linesPerPage));
    }

    await writeFile(filePath, buildSimplePdf(pages));

    return {
      filename,
      filePath,
      compressed: false,
      contentType: 'application/pdf',
    };
  }


}
