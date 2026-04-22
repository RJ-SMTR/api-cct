import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import * as xlsx from 'xlsx';
import { MailService } from 'src/mail/mail.service';
import { IRequest } from 'src/utils/interfaces/request.interface';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { FinancialMovementExportFormat, FinancialMovementExportRequestDto } from '../dtos/financial-movement-export-request.dto';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { RelatorioNovoRemessaFinancialMovementRepository } from './relatorio-novo-remessa-financial-movement.repository';
import {
  buildExportBaseFilename,
  buildSelectedStatusLabels,
  buildSummaryLines,
  csvEscape,
  formatFileDate,
  toExportRow,
  truncateText,
} from './financial-movement-export.utils';
import { buildSimplePdf } from './simple-pdf';

type GeneratedExportFile = {
  contentType: string;
  filename: string;
  filePath: string;
  compressed: boolean;
};

@Injectable()
export class RelatorioNovoRemessaFinancialMovementService {
  private readonly logger = new Logger(RelatorioNovoRemessaFinancialMovementService.name);

  constructor(
    private readonly relatorioNovoRemessaFinancialMovementRepository: RelatorioNovoRemessaFinancialMovementRepository,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
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

  async requestFinancialMovementExport(
    args: FinancialMovementExportRequestDto,
    requestUser: IRequest['user'],
  ) {
    this.ensureValidDateRange(args);
    const user = await this.usersService.getOne({ id: requestUser.id });

    if (!user.email) {
      throw new Error('Usuário autenticado não possui email para envio do relatório');
    }

    setImmediate(() => {
      void this.processFinancialMovementExport(args, user).catch((error) => {
        this.logger.error(
          `Erro ao processar export do relatório financeiro para o usuário ${user.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    });

    return {
      message: 'Seu relatório está sendo gerado e será enviado para o seu e-mail.',
    };
  }

  private ensureValidDateRange(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    if (args.dataInicio === undefined || args.dataFim === undefined ||
      new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }
  }

  private async processFinancialMovementExport(
    args: FinancialMovementExportRequestDto,
    user: User,
  ): Promise<void> {
    const summary = await this.findFinancialMovementSummary(args);
    const generatedFile = await this.generateExportFile(args, summary);

    try {
      await this.mailService.sendFinancialReportExport({
        to: user.email as string,
        data: {
          userName: user.fullName ?? user.firstName ?? 'user',
          filename: generatedFile.filename,
          format: args.format,
          periodLabel: `${formatFileDate(new Date(args.dataInicio))} to ${formatFileDate(new Date(args.dataFim))}`,
          attachmentPath: generatedFile.filePath,
          contentType: generatedFile.contentType,
          compressed: generatedFile.compressed,
        },
      });
    } finally {
      await rm(generatedFile.filePath, { force: true });
      await rm(dirname(generatedFile.filePath), { recursive: true, force: true });
    }
  }

  private async generateExportFile(
    args: FinancialMovementExportRequestDto,
    summary: Awaited<ReturnType<RelatorioNovoRemessaFinancialMovementService['findFinancialMovementSummary']>>,
  ): Promise<GeneratedExportFile> {
    switch (args.format) {
      case FinancialMovementExportFormat.CSV:
        return this.generateCsvExport(args, summary);
      case FinancialMovementExportFormat.XLSX:
        return this.generateXlsxExport(args, summary);
      case FinancialMovementExportFormat.PDF:
        return this.generatePdfExport(args, summary);
      default:
        throw new Error(`Formato não suportado: ${args.format}`);
    }
  }

  private async createExportDir(): Promise<string> {
    const exportDir = join(tmpdir(), `financial-report-${Date.now()}-${Math.round(Math.random() * 10000)}`);
    await mkdir(exportDir, { recursive: true });
    return exportDir;
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
      `Report Period,${csvEscape(`${formatFileDate(new Date(args.dataInicio))} to ${formatFileDate(new Date(args.dataFim))}`)}`,
      `Selected Statuses,${csvEscape(selectedStatuses.length ? selectedStatuses.join(', ') : 'Todos')}`,
      'Data Referencia,Data Pagamento,Nome,Email,Cod Banco,Banco,CPF/CNPJ,Consorcio,Valor,Status',
      ...summaryLines.map(([label, value]) => `Summary,${csvEscape(label)},${csvEscape(value)}`),
      '',
      'Data Referencia,Data Pagamento,Nome,Email,Cod Banco,Banco,CPF/CNPJ,Consorcio,Valor,Status',
    ];
  }

  private async generateCsvExport(
    args: FinancialMovementExportRequestDto,
    summary: Awaited<ReturnType<RelatorioNovoRemessaFinancialMovementService['findFinancialMovementSummary']>>,
  ): Promise<GeneratedExportFile> {
    const exportDir = await this.createExportDir();
    const shouldCompress = summary.count >= 5000;
    const baseFilename = buildExportBaseFilename(
      FinancialMovementExportFormat.CSV,
      new Date(args.dataInicio),
      new Date(args.dataFim),
    );
    const filename = shouldCompress ? `${baseFilename}.gz` : baseFilename;
    const filePath = join(exportDir, filename);

    const input = new PassThrough();
    const output = createWriteStream(filePath);
    const pipelinePromise = shouldCompress
      ? pipeline(input, createGzip(), output)
      : pipeline(input, output);

    for (const line of this.buildCsvHeaderLines(args, summary)) {
      await this.writeChunk(input, `${line}\n`);
    }

    await this.relatorioNovoRemessaFinancialMovementRepository.streamFinancialMovementRows(args, async (row) => {
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
      compressed: shouldCompress,
      contentType: shouldCompress ? 'application/gzip' : 'text/csv',
    };
  }

  private async generateXlsxExport(
    args: FinancialMovementExportRequestDto,
    summary: Awaited<ReturnType<RelatorioNovoRemessaFinancialMovementService['findFinancialMovementSummary']>>,
  ): Promise<GeneratedExportFile> {
    const exportDir = await this.createExportDir();
    const filename = buildExportBaseFilename(
      FinancialMovementExportFormat.XLSX,
      new Date(args.dataInicio),
      new Date(args.dataFim),
    );
    const filePath = join(exportDir, filename);
    const metadataRows: Array<Array<string>> = [
      ['Periodo', `${formatFileDate(new Date(args.dataInicio))} to ${formatFileDate(new Date(args.dataFim))}`],
      ['Status Selecionados', buildSelectedStatusLabels(args).join(', ') || 'Todos'],
      ...buildSummaryLines(summary),
    ];
    const dataRows: Array<Array<string>> = [
      ['Data Referencia', 'Data Pagamento', 'Nome', 'Email', 'Cod Banco', 'Banco', 'CPF/CNPJ', 'Consorcio', 'Valor', 'Status'],
    ];

    await this.relatorioNovoRemessaFinancialMovementRepository.streamFinancialMovementRows(args, async (row) => {
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
  ): Promise<GeneratedExportFile> {
    const exportDir = await this.createExportDir();
    const filename = buildExportBaseFilename(
      FinancialMovementExportFormat.PDF,
      new Date(args.dataInicio),
      new Date(args.dataFim),
    );
    const filePath = join(exportDir, filename);
    const lines: string[] = [
      'Financial Report',
      `Period: ${formatFileDate(new Date(args.dataInicio))} to ${formatFileDate(new Date(args.dataFim))}`,
      `Selected Statuses: ${buildSelectedStatusLabels(args).join(', ') || 'Todos'}`,
      '',
      'Data Ref. | Data Pgto | Nome | Email | Banco | Nome Banco | CPF/CNPJ | Consorcio | Valor | Status',
    ];

    await this.relatorioNovoRemessaFinancialMovementRepository.streamFinancialMovementRows(args, async (row) => {
      const exportRow = toExportRow(row);
      lines.push([
        truncateText(exportRow.dataReferencia, 10),
        truncateText(exportRow.dataPagamento, 10),
        truncateText(exportRow.nomes, 24),
        truncateText(exportRow.email, 28),
        truncateText(exportRow.codBanco, 5),
        truncateText(exportRow.nomeBanco, 16),
        truncateText(exportRow.cpfCnpj, 18),
        truncateText(exportRow.consorcio, 14),
        truncateText(exportRow.valor, 16),
        truncateText(exportRow.status, 16),
      ].join(' | '));
    });

    lines.push('', 'Summary');
    for (const [label, value] of buildSummaryLines(summary)) {
      lines.push(`${label}: ${value}`);
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
