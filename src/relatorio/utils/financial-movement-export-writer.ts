import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { utils as xlsxUtils, writeFile as xlsxWriteFile } from 'xlsx';
import { FinancialMovementPdfWriter } from '../movimentacao-financeira/financial-movement-pdf';
import { formatCurrency } from '../movimentacao-financeira/financial-movement-export.utils';
import { RelatorioFinancialMovementNovoRemessaData } from '../dtos/relatorio-financial-and-movement.dto';

export type FinancialMovementExportFormatValue = 'csv' | 'xlsx' | 'pdf';

export type FinancialMovementExportResult = {
  filePath: string;
  fileName: string;
  filename: string;
  contentType: string;
};

type StreamRows = (onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void) => Promise<void>;

// metadata do cabeçalho do PDF (período/status observado), no mesmo formato do Consolidado
// (ConsolidatedReportPage.js, exportPDF) - undefined quando chamado de um contexto sem esses
// dados (ex.: formato csv/xlsx não usa, então nenhum chamador é obrigado a passá-lo).
export type FinancialMovementExportMeta = {
  dataInicio?: Date;
  dataFim?: Date;
  statusLabels?: string[];
};

// Mesmas colunas usadas pelo CSV original (Permissionário e Guardador). Compartilhada entre
// os três formatos para os três não divergirem silenciosamente entre si. pdfWeight é o peso
// relativo da coluna na largura da tabela do PDF (ver financial-movement-pdf.ts).
const COLUMNS: Array<{
  key: keyof RelatorioFinancialMovementNovoRemessaData;
  label: string;
  pdfWeight: number;
  pdfAlign?: 'left' | 'right';
  pdfLabel?: string;
}> = [
  { key: 'dataReferencia', label: 'Data Referência', pdfWeight: 10, pdfLabel: 'Dt Refer.' },
  { key: 'dataPagamento', label: 'Data Pagamento', pdfWeight: 10, pdfLabel: 'Dt Pagto.' },
  { key: 'nomes', label: 'Nome', pdfWeight: 18 },
  { key: 'email', label: 'Email', pdfWeight: 20 },
  { key: 'codBanco', label: 'Banco', pdfWeight: 5 },
  { key: 'nomeBanco', label: 'Nome Banco', pdfWeight: 12 },
  { key: 'cpfCnpj', label: 'CPF/CNPJ', pdfWeight: 14 },
  { key: 'consorcio', label: 'Consórcio', pdfWeight: 9 },
  { key: 'valor', label: 'Valor', pdfWeight: 11, pdfAlign: 'right' },
  { key: 'status', label: 'Status', pdfWeight: 20 },
  { key: 'descricaoErro', label: 'Erro', pdfWeight: 16 },
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

// Mesmo layout do PDF do Consolidado (app-cct, ConsolidatedReportPage.js/exportPDF): logo,
// cabeçalho com período/status, grade de tabela de verdade e rodapé com paginação + valor
// total - ver financial-movement-pdf.ts.
async function writePdf(prefix: string, streamRows: StreamRows, meta: FinancialMovementExportMeta = {}): Promise<FinancialMovementExportResult> {
  const fileName = `${prefix}-${Date.now()}.pdf`;
  const filePath = path.join(os.tmpdir(), fileName);

  const writer = new FinancialMovementPdfWriter({
    filePath,
    title: 'Relatório de Movimentação Financeira',
    dataInicio: meta.dataInicio,
    dataFim: meta.dataFim,
    statusLabels: meta.statusLabels ?? [],
    columns: COLUMNS.map((c) => ({ key: c.key, label: c.pdfLabel ?? c.label, weight: c.pdfWeight, align: c.pdfAlign })),
  });

  await streamRows((row) => {
    const values: Record<string, string | number> = {};
    for (const column of COLUMNS) {
      values[column.key] = column.key === 'valor' ? formatCurrency(row.valor) : String(row[column.key] ?? '');
    }
    writer.addRow(values, Number(row.valor ?? 0));
  });

  await writer.finish();
  return { filePath, fileName, filename: fileName, contentType: 'application/pdf' };
}

export async function writeFinancialMovementExport(
  format: FinancialMovementExportFormatValue,
  fileNamePrefix: string,
  streamRows: StreamRows,
  meta?: FinancialMovementExportMeta,
): Promise<FinancialMovementExportResult> {
  if (format === 'xlsx') return writeXlsx(fileNamePrefix, streamRows);
  if (format === 'pdf') return writePdf(fileNamePrefix, streamRows, meta);
  return writeCsv(fileNamePrefix, streamRows);
}
