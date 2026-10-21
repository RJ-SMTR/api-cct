import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import { FinancialMovementPdfWriter } from './financial-movement-pdf';

const COLUMNS = [
  { key: 'nome', label: 'Nome', weight: 2 },
  { key: 'valor', label: 'Valor', weight: 1, align: 'right' as const },
];

async function extractText(filePath: string): Promise<string> {
  const { text } = await pdfParse(fs.readFileSync(filePath));
  return text;
}

// pdf-parse (pdfjs-dist under the hood) can take well over the 5s default under full-suite
// parallel load - bump it instead of risking a flaky timeout failure in CI.
jest.setTimeout(20000);

describe('FinancialMovementPdfWriter', () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    while (tmpFiles.length) {
      const file = tmpFiles.pop();
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  const newFilePath = () => {
    const filePath = path.join(os.tmpdir(), `financial-movement-pdf-spec-${Date.now()}-${Math.random()}.pdf`);
    tmpFiles.push(filePath);
    return filePath;
  };

  it('writes a valid PDF containing the title, period and status header (same shape as the Consolidado export)', async () => {
    const filePath = newFilePath();
    const writer = new FinancialMovementPdfWriter({
      filePath,
      title: 'Relatório de Movimentação Financeira',
      dataInicio: new Date('2026-09-09T00:00:00Z'),
      dataFim: new Date('2026-09-10T00:00:00Z'),
      statusLabels: ['Pago'],
      columns: COLUMNS,
    });
    writer.addRow({ nome: 'ALEXANDRA MAURICIO ANGELO', valor: 'R$ 3.027,12' }, 3027.12);
    await writer.finish();

    const text = await extractText(filePath);

    expect(text).toContain('Relatório de Movimentação Financeira');
    expect(text).toContain('Relatório dos dias: 09/09/2026 a 10/09/2026');
    expect(text).toContain('Status observado: Pago');
    expect(text).toContain('ALEXANDRA MAURICIO ANGELO');
  });

  it('reports the row count and the sum of valorNumerico as the total, not the formatted string', async () => {
    const filePath = newFilePath();
    const writer = new FinancialMovementPdfWriter({
      filePath,
      title: 'Relatório de Movimentação Financeira',
      statusLabels: [],
      columns: COLUMNS,
    });
    writer.addRow({ nome: 'A', valor: 'R$ 10,00' }, 10);
    writer.addRow({ nome: 'B', valor: 'R$ 5,50' }, 5.5);
    const result = await writer.finish();

    expect(result.rowCount).toBe(2);
    expect(result.total).toBeCloseTo(15.5);
  });

  it('writes "Status observado: Todos" when no status was selected', async () => {
    const filePath = newFilePath();
    const writer = new FinancialMovementPdfWriter({
      filePath,
      title: 'Relatório de Movimentação Financeira',
      statusLabels: [],
      columns: COLUMNS,
    });
    writer.addRow({ nome: 'A', valor: 'R$ 1,00' }, 1);
    await writer.finish();

    const text = await extractText(filePath);
    expect(text).toContain('Status observado: Todos');
  });

  it('breaks into more than one page when rows overflow the first page, and writes the page count/total only once', async () => {
    const filePath = newFilePath();
    const writer = new FinancialMovementPdfWriter({
      filePath,
      title: 'Relatório de Movimentação Financeira',
      statusLabels: ['Pago'],
      columns: COLUMNS,
    });
    for (let i = 0; i < 60; i += 1) {
      writer.addRow({ nome: `Favorecido ${i}`, valor: 'R$ 1,00' }, 1);
    }
    const result = await writer.finish();

    const parsed = await pdfParse(fs.readFileSync(filePath));
    expect(parsed.numpages).toBeGreaterThan(1);
    expect(parsed.text.match(/Página \d+ de \d+/g)?.length).toBe(parsed.numpages);
    expect(parsed.text.match(/Valor total:/g) ?? []).toHaveLength(1);
    expect(result.total).toBe(60);
  });
});
