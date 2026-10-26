import * as fs from 'fs';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import { formatCurrency } from './financial-movement-export.utils';

const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'logo-prefeitura.png');

const PAGE_SIZE: [number, number] = [842, 595]; // A4 landscape, pt - same as the Consolidado PDF (app-cct ConsolidatedReportPage.js).
const MARGIN = 28;
const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN * 2;
const HEADER_HEIGHT = 86; // Logo + separator line + title/period/status, stacked vertically.
const FOOTER_HEIGHT = 24;
const ROW_HEIGHT = 16;
const LINE_HEIGHT = 9; // altura de uma linha extra dentro de uma célula de 2 linhas (cabeçalho ou dado como "Ord. de Pag.").
const HEADER_FONT_SIZE = 8;
const ROW_FONT_SIZE = 7;

export type FinancialMovementPdfColumn = {
  key: string;
  label: string;
  /** Relative weight used to split CONTENT_WIDTH between columns (same ratios as the old char-based widths). */
  weight: number;
  align?: 'left' | 'right';
};

type FinancialMovementPdfOptions = {
  filePath: string;
  title: string;
  dataInicio?: Date;
  dataFim?: Date;
  statusLabels: string[];
  columns: FinancialMovementPdfColumn[];
};

const formatDate = (date?: Date): string | undefined => (date ? date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : undefined);

// Mirrors ConsolidatedReportPage.js's exportPDF: logo top-left, separator line, "Relatório dos
// dias" / "Status observado" text block - so both reports look the same to whoever opens them.
export class FinancialMovementPdfWriter {
  private readonly doc: PDFKit.PDFDocument;
  private readonly stream: fs.WriteStream;
  private readonly columns: Array<FinancialMovementPdfColumn & { x: number; width: number }>;
  private total = 0;
  private rowCount = 0;
  private cursorY = 0;
  private headerRowHeight = ROW_HEIGHT;
  private readonly ready: Promise<void>;

  constructor(private readonly options: FinancialMovementPdfOptions) {
    this.doc = new PDFDocument({ size: PAGE_SIZE, margin: MARGIN, bufferPages: true });
    this.stream = fs.createWriteStream(options.filePath);
    this.doc.pipe(this.stream);

    const totalWeight = options.columns.reduce((sum, c) => sum + c.weight, 0);
    let x = MARGIN;
    this.columns = options.columns.map((column) => {
      const width = (column.weight / totalWeight) * CONTENT_WIDTH;
      const positioned = { ...column, x, width };
      x += width;
      return positioned;
    });

    this.drawPageHeader();
    this.drawTableHeader();

    this.ready = new Promise((resolve, reject) => {
      this.stream.on('finish', resolve);
      this.stream.on('error', reject);
    });
  }

  // Células com \n explícito (ex.: colunas "Ord. de Pag. N" - data em cima, valor embaixo,
  // igual à tela) ocupam 2 linhas; a linha da tabela cresce para a maior célula daquela linha.
  addRow(values: Record<string, string | number | undefined>, valorNumerico: number): void {
    // fitText mede largura com doc.widthOfString(), que depende da fonte/tamanho ativos no
    // doc neste momento - por isso a fonte da linha precisa ser setada ANTES de qualquer
    // chamada a fitText, senão a medição usa a fonte (maior) deixada pelo cabeçalho.
    this.doc.font('Helvetica').fontSize(ROW_FONT_SIZE);
    const cellLines = this.columns.map((column) => {
      const raw = values[column.key];
      const text = raw === undefined || raw === null ? '' : String(raw);
      return text.split('\n').map((line) => this.fitText(line, column.width - 4));
    });
    const rowHeight = Math.max(ROW_HEIGHT, LINE_HEIGHT * Math.max(...cellLines.map((lines) => lines.length)) + 7);

    if (this.cursorY + rowHeight > PAGE_SIZE[1] - MARGIN - FOOTER_HEIGHT) {
      this.doc.addPage({ size: PAGE_SIZE, margin: MARGIN });
      this.drawPageHeader();
      this.drawTableHeader();
    }

    const rowY = this.cursorY;
    this.doc.font('Helvetica').fontSize(ROW_FONT_SIZE);
    this.columns.forEach((column, i) => {
      cellLines[i].forEach((line, lineIndex) => {
        this.doc.text(line, column.x + 2, rowY + 3 + lineIndex * LINE_HEIGHT, {
          width: column.width - 4,
          align: column.align ?? 'left',
          lineBreak: false,
        });
      });
    });
    this.doc.moveTo(MARGIN, rowY + rowHeight).lineTo(MARGIN + CONTENT_WIDTH, rowY + rowHeight).lineWidth(0.3).strokeColor('#cccccc').stroke();

    this.rowCount += 1;
    if (Number.isFinite(valorNumerico)) this.total += valorNumerico;

    this.cursorY += rowHeight;
  }

  async finish(): Promise<{ filePath: string; rowCount: number; total: number }> {
    this.drawFooterOnEveryPage();
    this.doc.end();
    await this.ready;
    return { filePath: this.options.filePath, rowCount: this.rowCount, total: this.total };
  }

  // Texto medido de verdade (doc.widthOfString), não contagem de caracteres: "lineBreak:false"
  // sozinho não impede o pdfkit de quebrar linha quando o texto não cabe na largura da coluna -
  // sem isso, nomes/bancos longos vazavam para a linha de baixo (confirmado visualmente).
  private fitText(text: string, maxWidth: number): string {
    if (this.doc.widthOfString(text) <= maxWidth) return text;
    const ellipsis = '…';
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (this.doc.widthOfString(text.slice(0, mid) + ellipsis) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? `${text.slice(0, lo)}${ellipsis}` : ellipsis;
  }

  private drawPageHeader(): void {
    if (fs.existsSync(LOGO_PATH)) {
      // width: 70 at the logo's real aspect ratio (751x377) renders ~35pt tall, so its bottom
      // sits around MARGIN + 25 - the separator line must clear that before drawing the title.
      this.doc.image(LOGO_PATH, MARGIN, MARGIN - 10, { width: 70 });
    }
    this.doc
      .moveTo(MARGIN, MARGIN + 32)
      .lineTo(MARGIN + CONTENT_WIDTH, MARGIN + 32)
      .lineWidth(0.6)
      .strokeColor('#000000')
      .stroke();

    this.doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(this.options.title, MARGIN, MARGIN + 38);

    const periodo = this.options.dataInicio && this.options.dataFim
      ? `Relatório dos dias: ${formatDate(this.options.dataInicio)} a ${formatDate(this.options.dataFim)}`
      : undefined;
    this.doc.font('Helvetica').fontSize(8);
    let y = MARGIN + 52;
    if (periodo) {
      this.doc.text(periodo, MARGIN, y);
      y += 11;
    }
    this.doc.text(`Status observado: ${this.options.statusLabels.length ? this.options.statusLabels.join(', ') : 'Todos'}`, MARGIN, y);

    this.cursorY = MARGIN + HEADER_HEIGHT;
  }

  // Quebra um label em até 2 linhas, cada uma cortada em uma fronteira de palavra que caiba na
  // largura da coluna (nunca corta no meio de uma palavra). Se nem duas linhas bastarem, a
  // segunda linha leva reticências (via fitText).
  private wrapToTwoLines(label: string, maxWidth: number): string[] {
    if (this.doc.widthOfString(label) <= maxWidth) return [label];
    const words = label.split(' ');
    let line1 = '';
    let i = 0;
    for (; i < words.length; i += 1) {
      const candidate = line1 ? `${line1} ${words[i]}` : words[i];
      if (this.doc.widthOfString(candidate) > maxWidth) break;
      line1 = candidate;
    }
    if (i === 0) {
      // nem a primeira palavra cabe sozinha: não há como quebrar por palavra, usa 1 linha com reticências.
      return [this.fitText(label, maxWidth)];
    }
    const line2 = words.slice(i).join(' ');
    return line2 ? [line1, this.fitText(line2, maxWidth)] : [line1];
  }

  private drawTableHeader(): void {
    const y = this.cursorY;
    this.doc.font('Helvetica-Bold').fontSize(HEADER_FONT_SIZE).fillColor('#000000');
    const wrapped = this.columns.map((column) => this.wrapToTwoLines(column.label, column.width - 4));
    const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length));
    this.headerRowHeight = maxLines > 1 ? LINE_HEIGHT * maxLines + 7 : ROW_HEIGHT;

    this.doc.rect(MARGIN, y, CONTENT_WIDTH, this.headerRowHeight).fillColor('#e0e0e0').fill();
    this.doc.fillColor('#000000');
    this.columns.forEach((column, i) => {
      wrapped[i].forEach((line, lineIndex) => {
        this.doc.text(line, column.x + 2, y + 4 + lineIndex * LINE_HEIGHT, { width: column.width - 4, align: column.align ?? 'left', lineBreak: false });
      });
    });
    this.doc.moveTo(MARGIN, y + this.headerRowHeight).lineTo(MARGIN + CONTENT_WIDTH, y + this.headerRowHeight).lineWidth(0.8).strokeColor('#000000').stroke();
    this.cursorY = y + this.headerRowHeight;
  }

  private drawFooterOnEveryPage(): void {
    const range = this.doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      this.doc.switchToPage(i);
      this.doc.font('Helvetica').fontSize(8).fillColor('#000000');
      this.doc.text(`Página ${i - range.start + 1} de ${range.count}`, MARGIN, PAGE_SIZE[1] - MARGIN - 10, { lineBreak: false });
      if (i === range.start + range.count - 1) {
        this.doc.text(`Valor total: ${formatCurrency(this.total)}`, MARGIN, PAGE_SIZE[1] - MARGIN + 2, { lineBreak: false });
      }
    }
  }
}
