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

// O modelo de colunas "Ord. de Pag. N" (ADR 0012) é exclusivo do Relatório Consolidado - a
// Movimentação Financeira nunca ganha colunas extras para o filtro STUC - Gratuidade, mesmo
// quando o campo `stuc` é passado como true (mantido por compatibilidade de assinatura).
describe('writeFinancialMovementExport - sem colunas extras de STUC (Movimentação Financeira)', () => {
  it('never includes the STUC payment window fields in the CSV header, regardless of the stuc flag', async () => {
    const withoutStuc = await writeFinancialMovementExport('csv', 'test', streamOneRow, undefined, false);
    const withStuc = await writeFinancialMovementExport('csv', 'test', streamOneRow, undefined, true);
    for (const { filePath } of [withoutStuc, withStuc]) {
      const [header] = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      expect(header).not.toContain('dataOrdemPagamento1');
      expect(header).toContain('valor');
      fs.unlinkSync(filePath);
    }
  });

  it('writes a valid XLSX regardless of the stuc flag', async () => {
    const { filePath } = await writeFinancialMovementExport('xlsx', 'test', streamOneRow, undefined, true);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    fs.unlinkSync(filePath);
  });

  it('writes a valid PDF regardless of the stuc flag', async () => {
    const { filePath } = await writeFinancialMovementExport('pdf', 'test', streamOneRow, undefined, true);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    fs.unlinkSync(filePath);
  });
});
