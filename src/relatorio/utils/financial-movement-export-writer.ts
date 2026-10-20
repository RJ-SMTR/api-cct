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
// os três formatos para os três não divergirem silenciosamente entre si.
const COLUMNS: Array<{ key: keyof RelatorioFinancialMovementNovoRemessaData; label: string; pdfWidth: number }> = [
  { key: 'dataReferencia', label: 'Data Referência', pdfWidth: 10 },
  { key: 'dataPagamento', label: 'Data Pagamento', pdfWidth: 10 },
  { key: 'nomes', label: 'Nome', pdfWidth: 24 },
  { key: 'email', label: 'Email', pdfWidth: 26 },
  { key: 'codBanco', label: 'Banco', pdfWidth: 5 },
  { key: 'nomeBanco', label: 'Nome Banco', pdfWidth: 16 },
  { key: 'cpfCnpj', label: 'CPF/CNPJ', pdfWidth: 18 },
  { key: 'consorcio', label: 'Consórcio', pdfWidth: 14 },
  { key: 'valor', label: 'Valor', pdfWidth: 12 },
  { key: 'status', label: 'Status', pdfWidth: 16 },
  { key: 'descricaoErro', label: 'Erro', pdfWidth: 20 },
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

// buildSimplePdf escreve com uma fonte Helvetica base14 (WinAnsi) e não dá para medir texto
// nem quebrar página sozinho - por isso cada linha é truncada e acentuada com toPdfSafeText
// antes de virar uma única linha de texto, igual ao formato de export por e-mail que existia
// antes desse fluxo ser movido para download direto (ver histórico de simple-pdf.ts).
async function writePdf(prefix: string, streamRows: StreamRows): Promise<FinancialMovementExportResult> {
  const fileName = `${prefix}-${Date.now()}.pdf`;
  const filePath = path.join(os.tmpdir(), fileName);

  const formatRow = (values: unknown[]) =>
    values.map((value, i) => truncateText(toPdfSafeText(String(value ?? '')), COLUMNS[i].pdfWidth)).join(' | ');

  const lines: string[] = [
    'Relatorio de Movimentacao Financeira',
    '',
    COLUMNS.map((c) => toPdfSafeText(c.label)).join(' | '),
  ];
  await streamRows((row) => {
    lines.push(formatRow(COLUMNS.map((c) => row[c.key])));
  });

  const linesPerPage = 40;
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
