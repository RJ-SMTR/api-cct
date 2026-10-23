import * as fs from 'fs';
import { writeFinancialMovementExport } from './financial-movement-export-writer';
import { RelatorioFinancialMovementNovoRemessaData } from '../dtos/relatorio-financial-and-movement.dto';

const ROW: RelatorioFinancialMovementNovoRemessaData = {
  dataReferencia: '23/10/2026',
  dataPagamento: '27/10/2026',
  nomes: 'FULANO',
  email: 'fulano@email.com',
  codBanco: 1 as any,
  nomeBanco: 'BB',
  cpfCnpj: '12345678900',
  consorcio: 'Consorcio A',
  valor: 100,
  status: 'Pago',
  descricaoErro: '',
  dataOrdemPagamento1: '23/10/2026',
  valorOrdemPagamento1: 10,
  dataOrdemPagamento2: '24/10/2026',
  valorOrdemPagamento2: 20,
  dataOrdemPagamento3: '25/10/2026',
  valorOrdemPagamento3: 30,
  dataOrdemPagamento4: null,
  valorOrdemPagamento4: null,
};

const streamOneRow = async (onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void) => {
  await onRow(ROW);
};

describe('writeFinancialMovementExport - STUC payment window columns (ADR 0012)', () => {
  it('omits the 8 STUC columns from the CSV when stuc is false (regression)', async () => {
    const { filePath } = await writeFinancialMovementExport('csv', 'test', streamOneRow, undefined, false);
    const [header] = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(header).not.toContain('dataOrdemPagamento1');
    fs.unlinkSync(filePath);
  });

  it('appends the 8 STUC columns to the CSV, with comma-decimal values, when stuc is true', async () => {
    const { filePath } = await writeFinancialMovementExport('csv', 'test', streamOneRow, undefined, true);
    const [header, line] = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(header.endsWith('dataOrdemPagamento4;valorOrdemPagamento4')).toBe(true);
    expect(line.endsWith('25/10/2026;30;;')).toBe(true);
    fs.unlinkSync(filePath);
  });

  it('appends the 8 STUC columns to the XLSX header when stuc is true', async () => {
    const { filePath } = await writeFinancialMovementExport('xlsx', 'test', streamOneRow, undefined, true);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    fs.unlinkSync(filePath);
  });

  it('appends the 8 STUC columns to the PDF table when stuc is true', async () => {
    const { filePath } = await writeFinancialMovementExport('pdf', 'test', streamOneRow, undefined, true);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    fs.unlinkSync(filePath);
  });
});
