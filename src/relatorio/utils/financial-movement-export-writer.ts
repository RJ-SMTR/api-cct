import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { utils as xlsxUtils, writeFile as xlsxWriteFile } from 'xlsx';
import { buildSimplePdf } from '../movimentacao-financeira/simple-pdf';
import { toPdfSafeText, truncateText } from '../movimentacao-financeira/financial-movement-export.utils';
import { RelatorioFinancialMovementNovoRemessaData } from '../dtos/relatorio-financial-and-movement.dto';

export type FinancialMovementExportFormatValue = 'csv' | 'xlsx' | 'pdf';

export type FinancialMovementExportResult = {
  filePath: string;
  fileName: string;
  filename: string;
  contentType: string;
};

type StreamRows = (onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void) => Promise<void>;

// Mesmas colunas usadas pelo CSV original (Permissionário e Guardador). Compartilhada entre
// os três formatos para os três não divergirem silenciosamente entre si. pdfWidth é em
// caracteres (a fonte do PDF é monoespaçada - ver simple-pdf.ts) e soma, com os espaços de
// respiro entre colunas (PDF_COLUMN_GAP), até a largura útil da página em PDF_FONT_SIZE.
const COLUMNS: Array<{
  key: keyof RelatorioFinancialMovementNovoRemessaData;
  label: string;
  pdfWidth: number;
  pdfAlign?: 'left' | 'right';
  pdfLabel?: string;
}> = [
  { key: 'dataReferencia', label: 'Data Referência', pdfWidth: 10, pdfLabel: 'Dt Refer.' },
  { key: 'dataPagamento', label: 'Data Pagamento', pdfWidth: 10, pdfLabel: 'Dt Pagto.' },
  { key: 'nomes', label: 'Nome', pdfWidth: 18 },
  { key: 'email', label: 'Email', pdfWidth: 20 },
  { key: 'codBanco', label: 'Banco', pdfWidth: 5 },
  { key: 'nomeBanco', label: 'Nome Banco', pdfWidth: 12 },
  { key: 'cpfCnpj', label: 'CPF/CNPJ', pdfWidth: 14 },
  { key: 'consorcio', label: 'Consórcio', pdfWidth: 9 },
  { key: 'valor', label: 'Valor', pdfWidth: 11, pdfAlign: 'right' },
  { key: 'status', label: 'Status', pdfWidth: 20 },
  { key: 'descricaoErro', label: 'Erro', pdfWidth: 16 },
];

const csvEscape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;

async function writeCsv(prefix: string, streamRows: StreamRows): Promise<FinancialMovementExportResult> {
  const fileName = `${prefix}-${Date.now()}.csv`;
  const filePath = path.join(os.tmpdir(), fileName);
  const ws = fs.createWriteStream(filePath, { encoding: 'utf8' });
  ws.write(COLUMNS.map((c) => c.key).join(';') + '\n');
  await streamRows((row) => {
    ws.write(
      COLUMNS.map((c) => {
        const value = row[c.key];
        if (c.key === 'nomes' || c.key === 'descricaoErro') return csvEscape(value);
        if (c.key === 'valor') return String(value ?? '').replace('.', ',');
        return String(value ?? '');
      }).join(';') + '\n',
    );
  });
  await new Promise<void>((resolve, reject) => ws.end((error: unknown) => (error ? reject(error) : resolve())));
  return { filePath, fileName, filename: fileName, contentType: 'text/csv; charset=utf-8' };
}

async function writeXlsx(prefix: string, streamRows: StreamRows): Promise<FinancialMovementExportResult> {
  const fileName = `${prefix}-${Date.now()}.xlsx`;
  const filePath = path.join(os.tmpdir(), fileName);
  const rows: Array<Array<string | number>> = [COLUMNS.map((c) => c.label)];
  await streamRows((row) => {
    rows.push(COLUMNS.map((c) => row[c.key] ?? ''));
  });
  const worksheet = xlsxUtils.aoa_to_sheet(rows);
  const workbook = xlsxUtils.book_new();
  xlsxUtils.book_append_sheet(workbook, worksheet, 'Movimentação');
  xlsxWriteFile(workbook, filePath);
  return {
    filePath,
    fileName,
    filename: fileName,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

// Espaços de respiro entre colunas e separador do cabeçalho - dá a aparência de tabela sem
// precisar desenhar grade (buildSimplePdf só sabe escrever linhas de texto simples).
const PDF_COLUMN_GAP = '   ';

const padColumn = (value: string, width: number, align: 'left' | 'right'): string => {
  const truncated = truncateText(value, width);
  return align === 'right' ? truncated.padStart(width, ' ') : truncated.padEnd(width, ' ');
};

const formatPdfRow = (values: unknown[]): string =>
  COLUMNS.map((column, i) => padColumn(toPdfSafeText(String(values[i] ?? '')), column.pdfWidth, column.pdfAlign ?? 'left')).join(
    PDF_COLUMN_GAP,
  );

// buildSimplePdf escreve com uma fonte Courier monoespaçada (ver simple-pdf.ts) e não dá para
// quebrar página sozinho - por isso cada linha vira um array de texto já paginado, com as
// colunas alinhadas por espaço (padColumn) para parecer uma tabela de verdade.
async function writePdf(prefix: string, streamRows: StreamRows): Promise<FinancialMovementExportResult> {
  const fileName = `${prefix}-${Date.now()}.pdf`;
  const filePath = path.join(os.tmpdir(), fileName);

  const header = formatPdfRow(COLUMNS.map((c) => c.pdfLabel ?? c.label));
  const separator = '-'.repeat(header.length);
  const lines: string[] = ['Relatorio de Movimentacao Financeira', '', header, separator];
  await streamRows((row) => {
    lines.push(formatPdfRow(COLUMNS.map((c) => row[c.key])));
  });

  const linesPerPage = 38;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  await fs.promises.writeFile(filePath, buildSimplePdf(pages));
  return { filePath, fileName, filename: fileName, contentType: 'application/pdf' };
}

export async function writeFinancialMovementExport(
  format: FinancialMovementExportFormatValue,
  fileNamePrefix: string,
  streamRows: StreamRows,
): Promise<FinancialMovementExportResult> {
  if (format === 'xlsx') return writeXlsx(fileNamePrefix, streamRows);
  if (format === 'pdf') return writePdf(fileNamePrefix, streamRows);
  return writeCsv(fileNamePrefix, streamRows);
}
