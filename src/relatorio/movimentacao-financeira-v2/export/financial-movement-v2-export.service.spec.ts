import * as fs from 'fs';
import {
  buildStatusLabelsFromFilter,
  buildSummaryFromRows,
  FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE,
  FinancialMovementV2ExportService,
} from './financial-movement-v2-export.service';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { buildSummaryLines } from '../../movimentacao-financeira/financial-movement-export.utils';
import { BasePagamentoPage, BasePagamentoRepository, BasePagamentoRow } from '../base/base-pagamento.repository';
import { StucGratuidadeRepository, StucGratuidadeRow } from '../stuc-gratuidade/stuc-gratuidade.repository';

function row(partial: Partial<BasePagamentoRow>): BasePagamentoRow {
  return {
    dataReferencia: new Date('2026-10-23T00:00:00Z'),
    nomes: 'FULANO',
    cpfCnpj: '12345678900',
    nomeConsorcio: 'VLT',
    valor: '100.00',
    status: StatusPagamento.PAGO,
    ...partial,
  };
}

function buildRepositories(): { base: BasePagamentoRepository; stuc: StucGratuidadeRepository } {
  const base = { findGroupedRowsPage: jest.fn(), findEleicaoRows: jest.fn() } as unknown as BasePagamentoRepository;
  const stuc = { findRows: jest.fn() } as unknown as StucGratuidadeRepository;
  return { base, stuc };
}

async function collectRows(
  service: FinancialMovementV2ExportService,
  perfil: 'permissionario' | 'guardador',
  filter: Parameters<FinancialMovementV2ExportService['streamExportRows']>[1],
) {
  const collected: unknown[] = [];
  await service.streamExportRows(perfil, filter, (r) => {
    collected.push(r);
  });
  return collected;
}

describe('FinancialMovementV2ExportService', () => {
  // Comportamento 1 (Test-First Plan T9): export a partir de um conjunto de linhas produzido
  // pela query nova (T2/T3) produz o mesmo conteudo (colunas, valores) que o export atual -
  // adaptado para BASE_COLUMNS via toExportRow (adapter de borda, nao mudanca de colunas).
  it('adapts BasePagamentoRow into the shape the shared BASE_COLUMNS/writer expect', async () => {
    const { base, stuc } = buildRepositories();
    (base.findGroupedRowsPage as jest.Mock).mockResolvedValueOnce({
      rows: [row({ nomes: 'MARIA', cpfCnpj: '11122233344', nomeConsorcio: 'VLT', valor: '250.50', status: StatusPagamento.A_PAGAR })],
      nextCursor: null,
    } as BasePagamentoPage);

    const service = new FinancialMovementV2ExportService(base, stuc);
    const rows = await collectRows(service, 'permissionario', {
      dataInicio: new Date('2026-10-01'),
      dataFim: new Date('2026-10-31'),
    });

    expect(rows).toEqual([
      expect.objectContaining({
        dataReferencia: '23/10/2026',
        nomes: 'MARIA',
        cpfCnpj: '11122233344',
        consorcio: 'VLT',
        valor: 250.5,
        status: StatusPagamento.A_PAGAR,
      }),
    ]);
  });

  // Comportamento 2: STUC-Gratuidade usa as colunas por dia da janela, incluindo um dia com
  // valor 0 (nao em branco - pivotStucGratuidadeRows ja preenche a data real + valor 0).
  it('explodes a STUC-Gratuidade pivoted window into one row per day, keeping a zero-value day', async () => {
    const { base, stuc } = buildRepositories();
    const windowRow: StucGratuidadeRow = {
      nomes: 'JOAO',
      cpfCnpj: '55566677788',
      nomeConsorcio: null,
      status: StatusPagamento.PAGO,
      valor: 60,
      dataOrdemPagamento1: new Date('2026-10-23T00:00:00Z'), // sexta
      valorOrdemPagamento1: 20,
      dataOrdemPagamento2: new Date('2026-10-24T00:00:00Z'), // sabado
      valorOrdemPagamento2: 0,
      dataOrdemPagamento3: new Date('2026-10-25T00:00:00Z'), // domingo
      valorOrdemPagamento3: 40,
      dataOrdemPagamento4: null,
      valorOrdemPagamento4: null,
    };
    (stuc.findRows as jest.Mock).mockResolvedValueOnce([windowRow]);

    const service = new FinancialMovementV2ExportService(base, stuc);
    const rows = await collectRows(service, 'permissionario', {
      dataInicio: new Date('2026-10-23'),
      dataFim: new Date('2026-10-26'),
      stucGratuidade: true,
    });

    expect(rows).toEqual([
      expect.objectContaining({ dataReferencia: '23/10/2026', valor: 20, valorLancamento: 60, dataPagamento: '27/10/2026' }),
      expect.objectContaining({ dataReferencia: '24/10/2026', valor: 0, valorLancamento: 60, dataPagamento: '27/10/2026' }),
      expect.objectContaining({ dataReferencia: '25/10/2026', valor: 40, valorLancamento: 60, dataPagamento: '27/10/2026' }),
    ]);
    // 4a posicao nunca existiu (janela de 3 dias) - nao gera linha nenhuma, nao uma linha vazia.
    expect(rows).toHaveLength(3);
  });

  // Comportamento 3: periodo grande (>500 linhas) usa streaming em lotes - contagem de
  // chamadas a findGroupedRowsPage, nao memoria real.
  it('streams base rows in FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE batches via keyset pagination, not a single in-memory load', async () => {
    const { base, stuc } = buildRepositories();
    const firstBatch = Array.from({ length: FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE }, (_, i) => row({ nomes: `N${i}` }));
    const secondBatch = Array.from({ length: 37 }, (_, i) => row({ nomes: `M${i}` }));
    const cursorAfterFirstPage = { dataReferencia: new Date('2026-10-23'), nomes: 'N499', cpfCnpj: null, nomeConsorcio: null, status: null, valor: null };
    (base.findGroupedRowsPage as jest.Mock)
      .mockResolvedValueOnce({ rows: firstBatch, nextCursor: cursorAfterFirstPage } as BasePagamentoPage)
      .mockResolvedValueOnce({ rows: secondBatch, nextCursor: null } as BasePagamentoPage);

    const service = new FinancialMovementV2ExportService(base, stuc);
    const rows = await collectRows(service, 'permissionario', { dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31') });

    expect(base.findGroupedRowsPage).toHaveBeenCalledTimes(2);
    expect(base.findGroupedRowsPage).toHaveBeenNthCalledWith(1, 'permissionario', expect.anything(), FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE, undefined);
    expect(base.findGroupedRowsPage).toHaveBeenNthCalledWith(2, 'permissionario', expect.anything(), FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE, cursorAfterFirstPage);
    expect(rows).toHaveLength(FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE + 37);
  });

  // Edge case: filtro sem resultado nenhum - nenhuma linha emitida, sem erro.
  it('emits zero rows for an empty page without throwing', async () => {
    const { base, stuc } = buildRepositories();
    (base.findGroupedRowsPage as jest.Mock).mockResolvedValueOnce({ rows: [], nextCursor: null } as BasePagamentoPage);

    const service = new FinancialMovementV2ExportService(base, stuc);
    const rows = await collectRows(service, 'guardador', { dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31') });

    expect(rows).toEqual([]);
  });

  // Comportamento 4: o resumo exibido no cabecalho (buildSummaryLines/buildSelectedStatusLabels)
  // bate com o resultado da query nova para o mesmo filtro - valores esperados calculados a
  // mao (independente da soma feita por buildSummaryFromRows).
  it('summarizes BasePagamentoRow totals per status bucket matching an independently computed total', () => {
    const rows: BasePagamentoRow[] = [
      row({ status: StatusPagamento.PAGO, valor: '100.00' }),
      row({ status: StatusPagamento.PAGO, valor: '50.00' }),
      row({ status: StatusPagamento.A_PAGAR, valor: '30.00' }),
      row({ status: StatusPagamento.ERRO_REJEITADO, valor: '20.00' }),
    ];

    const summary = buildSummaryFromRows(rows);

    // Somado a mao: Pago = 150, A Pagar = 30, Rejeitado = 20, Total = 200.
    expect(summary.valorPago).toBe(150);
    expect(summary.valorAPagar).toBe(30);
    expect(summary.valorRejeitado).toBe(20);
    expect(summary.valorTotal).toBe(200);

    expect(buildSummaryLines(summary)).toEqual([
      ['Total Pago', 'R$ 150,00'],
      ['Total Rejeitado', 'R$ 20,00'],
      ['Total A Pagar', 'R$ 30,00'],
      ['Valor Total', 'R$ 200,00'],
    ]);
  });

  it('maps the new statuses[] filter into the same status labels the PDF header shows today', () => {
    expect(buildStatusLabelsFromFilter([StatusPagamento.PAGO, StatusPagamento.A_PAGAR])).toEqual(['Pago', 'A Pagar']);
    expect(buildStatusLabelsFromFilter(undefined)).toEqual([]);
    expect(buildStatusLabelsFromFilter([StatusPagamento.PENDENCIA_PAGA, StatusPagamento.PENDENTES])).toEqual(['Pendência Paga', 'OPs Atrasadas']);
  });

  // Fecha o ciclo com o writer real (nao mockado): o CSV gerado a partir do streamExportRows
  // novo usa as MESMAS colunas/formatos do export atual (BASE_COLUMNS nao muda).
  it('produces the same CSV header the legacy export writer already produces for BASE_COLUMNS', async () => {
    const { base, stuc } = buildRepositories();
    (base.findGroupedRowsPage as jest.Mock).mockResolvedValueOnce({
      rows: [row({ valor: '10.00' })],
      nextCursor: null,
    } as BasePagamentoPage);
    const service = new FinancialMovementV2ExportService(base, stuc);

    const { filePath } = await service.downloadFinancialMovementExport('permissionario', {
      dataInicio: new Date('2026-10-01'),
      dataFim: new Date('2026-10-31'),
      format: 'csv',
    });

    const [header] = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(header).toBe('dataReferencia;dataPagamento;nomes;email;codBanco;nomeBanco;cpfCnpj;consorcio;valor;status;descricaoErro');
    fs.unlinkSync(filePath);
  });
});
