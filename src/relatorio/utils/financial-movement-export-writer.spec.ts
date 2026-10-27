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
// Movimentação Financeira nunca ganha essas colunas extras, mesmo com STUC - Gratuidade. O
// `stuc` flag troca o conjunto de colunas (STUC_COLUMNS), não adiciona colunas ao conjunto base.
describe('writeFinancialMovementExport - sem colunas "Ord. de Pag. N" (Movimentação Financeira)', () => {
  it('never includes the STUC payment window fields in the CSV header, regardless of the stuc flag', async () => {
    const withoutStuc = await writeFinancialMovementExport('csv', 'test', streamOneRow, undefined, false);
    const withStuc = await writeFinancialMovementExport('csv', 'test', streamOneRow, undefined, true);
    for (const { filePath } of [withoutStuc, withStuc]) {
      const [header] = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      expect(header).not.toContain('dataOrdemPagamento1');
      fs.unlinkSync(filePath);
    }
  });
});

// STUC - Gratuidade: mesmas colunas da tela (StucGratuidadeTable.js) - Nome, CPF, Data Ordem,
// Valor Ordem, Valor Lançamento, Data de Pagamento - no lugar das colunas genéricas (Email,
// Banco, Nome Banco, Consórcio, Status, Erro) que essa tela não mostra para esse filtro.
describe('writeFinancialMovementExport - colunas do filtro STUC - Gratuidade', () => {
  const STUC_ROW: RelatorioFinancialMovementNovoRemessaData = {
    ...ROW,
    valor: 10, // valor do dia (streamFinancialMovementRows sobrescreve "valor" por linha)
    valorLancamento: 60, // total da janela, preservado à parte
  };
  const streamOneStucRow = async (onRow: (row: RelatorioFinancialMovementNovoRemessaData) => Promise<void> | void) => {
    await onRow(STUC_ROW);
  };

  it('CSV header uses the STUC columns, with both "valor" (dia) and "valorLancamento" (janela)', async () => {
    const { filePath } = await writeFinancialMovementExport('csv', 'test', streamOneStucRow, undefined, true);
    const [header, row] = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(header).toBe('nomes;cpfCnpj;dataReferencia;valor;valorLancamento;dataPagamento');
    expect(row).toBe('"FULANO";12345678900;23/10/2026;10;60;27/10/2026');
    fs.unlinkSync(filePath);
  });

  it('CSV header for the non-STUC flow is unaffected (Email/Banco/Consórcio/Status/Erro, no valorLancamento)', async () => {
    const { filePath } = await writeFinancialMovementExport('csv', 'test', streamOneRow, undefined, false);
    const [header] = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(header).toBe('dataReferencia;dataPagamento;nomes;email;codBanco;nomeBanco;cpfCnpj;consorcio;valor;status;descricaoErro');
    fs.unlinkSync(filePath);
  });

  it('writes a valid XLSX with the STUC columns', async () => {
    const { filePath } = await writeFinancialMovementExport('xlsx', 'test', streamOneStucRow, undefined, true);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    fs.unlinkSync(filePath);
  });

  it('writes a valid PDF with the STUC columns', async () => {
    const { filePath } = await writeFinancialMovementExport('pdf', 'test', streamOneStucRow, undefined, true);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    fs.unlinkSync(filePath);
  });
});
