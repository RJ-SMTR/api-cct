import * as fs from 'fs';
import { readFile as readXlsxFile, utils as xlsxUtils } from 'xlsx';
import {
  ASSOCIACAO_VALOR_GUARDADORES_LABEL,
  ASSOCIACAO_VALOR_PROPRIO_LABEL,
  buildAssociacaoExportLines,
  buildStatusLabelsFromFilter,
  buildSummaryFromRows,
  FINANCIAL_MOVEMENT_V2_EXPORT_BATCH_SIZE,
  FinancialMovementV2ExportService,
} from './financial-movement-v2-export.service';
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { MOTIVO_NAO_INFORMADO } from '../../novo-remessa/queries/descricao-erro';
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
  const base = {
    findGroupedRowsPage: jest.fn(),
    enriquecerLinhas: jest.fn().mockResolvedValue([]),
    findEleicaoRows: jest.fn(),
    findTotaisPorAssociacao: jest.fn().mockResolvedValue([]),
  } as unknown as BasePagamentoRepository;
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

  it('totals the "Abatimento por duplicidade" rows in their own bucket, out of Valor Pago', () => {
    const summary = buildSummaryFromRows([
      row({ status: StatusPagamento.PAGO, valor: '80.00' }),
      row({ status: StatusPagamento.ABATIMENTO_DUPLICIDADE, valor: '40.00' }),
      row({ status: StatusPagamento.ABATIMENTO_DUPLICIDADE, valor: '0.00' }),
    ]);

    expect(summary.valorPago).toBe(80);
    expect(summary.valorAbatimentoDuplicidade).toBe(40);
    expect(summary.valorTotal).toBe(120);
    expect(buildSummaryLines(summary)).toEqual([
      ['Total Pago', 'R$ 80,00'],
      ['Total Abatimento por duplicidade', 'R$ 40,00'],
      ['Valor Total', 'R$ 120,00'],
    ]);
    expect(buildStatusLabelsFromFilter([StatusPagamento.ABATIMENTO_DUPLICIDADE])).toEqual(['Abatimento por duplicidade']);
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

  describe('mensagem de erro do banco (mesma descricao que a tela mostra)', () => {
    const periodo = { dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31') };

    it.each([
      [StatusPagamento.ERRO_ESTORNO, '02', 'Crédito ou Débito Cancelado pelo Pagador/Credor'],
      [StatusPagamento.ERRO_REJEITADO, 'AT', 'Tipo/número de inscrição do favorecido inválido'],
      [StatusPagamento.ERRO_REJEITADO, 'ANHO', 'Conta digital'],
      [StatusPagamento.ERRO_REJEITADO, 'ZZ', 'Código ZZ'],
      [StatusPagamento.ERRO_REJEITADO, '02,AT', 'Crédito ou Débito Cancelado pelo Pagador/Credor / Tipo/número de inscrição do favorecido inválido'],
      [StatusPagamento.ERRO_REJEITADO, null, MOTIVO_NAO_INFORMADO],
    ])('status %s com codigoErro %s exporta "%s"', async (status, codigoErro, descricao) => {
      const { base, stuc } = buildRepositories();
      (base.findGroupedRowsPage as jest.Mock).mockResolvedValueOnce({ rows: [row({ status, codigoErro })], nextCursor: null } as BasePagamentoPage);

      const rows = await collectRows(new FinancialMovementV2ExportService(base, stuc), 'permissionario', periodo);

      expect(rows).toEqual([expect.objectContaining({ status, descricaoErro: descricao })]);
    });

    it('linha que nao e erro nao ganha descricao, mesmo com codigo', async () => {
      const { base, stuc } = buildRepositories();
      (base.findGroupedRowsPage as jest.Mock).mockResolvedValueOnce({ rows: [row({ status: StatusPagamento.PAGO, codigoErro: '00' })], nextCursor: null } as BasePagamentoPage);

      const [exportada] = (await collectRows(new FinancialMovementV2ExportService(base, stuc), 'guardador', periodo)) as Array<{ descricaoErro?: string }>;

      expect(exportada.descricaoErro).toBeUndefined();
    });

    it('Eleicao tambem exporta a descricao do erro do banco', async () => {
      const { base, stuc } = buildRepositories();
      (base.findEleicaoRows as jest.Mock).mockResolvedValueOnce([row({ status: StatusPagamento.ERRO_ESTORNO, codigoErro: '02' })]);

      const rows = await collectRows(new FinancialMovementV2ExportService(base, stuc), 'permissionario', { ...periodo, eleicao: true });

      expect(rows).toEqual([expect.objectContaining({ descricaoErro: 'Crédito ou Débito Cancelado pelo Pagador/Credor' })]);
    });

    it.each(['csv', 'xlsx'] as const)('o arquivo %s traz a mensagem na coluna de erro', async (format) => {
      const { base, stuc } = buildRepositories();
      (base.findGroupedRowsPage as jest.Mock).mockResolvedValueOnce({
        rows: [row({ status: StatusPagamento.ERRO_ESTORNO, codigoErro: '02' })],
        nextCursor: null,
      } as BasePagamentoPage);

      const { filePath } = await new FinancialMovementV2ExportService(base, stuc).downloadFinancialMovementExport('permissionario', { ...periodo, format });

      try {
        const ultimaColuna =
          format === 'csv'
            ? fs.readFileSync(filePath, 'utf8').trim().split('\n')[1].split(';').pop()
            : (xlsxUtils.sheet_to_json<string[]>(readXlsxFile(filePath).Sheets['Movimentação'], { header: 1 })[1] as string[]).pop();
        expect(ultimaColuna).toBe(format === 'csv' ? '"Crédito ou Débito Cancelado pelo Pagador/Credor"' : 'Crédito ou Débito Cancelado pelo Pagador/Credor');
      } finally {
        fs.unlinkSync(filePath);
      }
    });
  });

  // Linhas das associacoes no export do Guardador, como no export do Consolidado (regra de Rayanne, 2026-11-18).
  describe('linhas das associacoes (Guardador)', () => {
    const periodo = { dataInicio: new Date('2026-10-01'), dataFim: new Date('2026-10-31') };
    const totais = [{ nome: 'SINGAERJ', valorAssociacao: 1200, valorGuardadores: 5000.5 }];

    it('so a associacao selecionada: pagamento proprio; Todos os guardadores: pagamento proprio e guardadores; especificos ou ambas: so os guardadores', () => {
      const proprio = { nome: 'SINGAERJ', label: ASSOCIACAO_VALOR_PROPRIO_LABEL, valor: 1200 };
      const guardadores = { nome: 'SINGAERJ', label: ASSOCIACAO_VALOR_GUARDADORES_LABEL, valor: 5000.5 };
      expect(buildAssociacaoExportLines(totais, {})).toEqual([proprio]);
      expect(buildAssociacaoExportLines(totais, { todosGuardadores: true })).toEqual([proprio, guardadores]);
      expect(buildAssociacaoExportLines(totais, { userIds: [7] })).toEqual([guardadores]);
      expect(buildAssociacaoExportLines(totais, { exigirTodasAssociacoes: true, todosGuardadores: true })).toEqual([guardadores]);
    });

    it.each(['csv', 'xlsx', 'pdf'] as const)('o arquivo %s termina com a linha da associacao', async (format) => {
      const { base, stuc } = buildRepositories();
      (base.findGroupedRowsPage as jest.Mock).mockResolvedValueOnce({ rows: [row({ valor: '10.00' })], nextCursor: null } as BasePagamentoPage);
      (base.findTotaisPorAssociacao as jest.Mock).mockResolvedValueOnce(totais);
      const filtro = { ...periodo, consorcioNome: ['SINGAERJ'], todosGuardadores: true, format };

      const { filePath } = await new FinancialMovementV2ExportService(base, stuc).downloadFinancialMovementExport('guardador', filtro);

      try {
        expect(base.findTotaisPorAssociacao).toHaveBeenCalledWith(expect.objectContaining({ consorcioNome: ['SINGAERJ'], todosGuardadores: true }));
        const textoProprio = `Associação: SINGAERJ (${ASSOCIACAO_VALOR_PROPRIO_LABEL})`;
        const texto = `Associação: SINGAERJ (${ASSOCIACAO_VALOR_GUARDADORES_LABEL})`;
        if (format === 'csv') {
          const [penultima, ultima] = fs.readFileSync(filePath, 'utf8').trim().split('\n').slice(-2);
          expect(penultima).toBe(`;;"${textoProprio}";;;;;;1200;;""`);
          expect(ultima).toBe(`;;"${texto}";;;;;;5000,5;;""`);
        } else if (format === 'xlsx') {
          const linhas = xlsxUtils.sheet_to_json<string[]>(readXlsxFile(filePath).Sheets['Movimentação'], { header: 1 }) as Array<Array<string | number>>;
          expect(linhas).toHaveLength(4);
          expect(linhas[2][2]).toBe(textoProprio);
          expect(linhas[2][8]).toBe(1200);
          expect(linhas[3][2]).toBe(texto);
          expect(linhas[3][8]).toBe(5000.5);
        } else {
          expect(fs.statSync(filePath).size).toBeGreaterThan(0);
        }
      } finally {
        fs.unlinkSync(filePath);
      }
    });

    it('Permissionario nao busca totais por associacao', async () => {
      const { base, stuc } = buildRepositories();
      (base.findGroupedRowsPage as jest.Mock).mockResolvedValueOnce({ rows: [], nextCursor: null } as BasePagamentoPage);

      const { filePath } = await new FinancialMovementV2ExportService(base, stuc).downloadFinancialMovementExport('permissionario', { ...periodo, format: 'csv' });

      fs.unlinkSync(filePath);
      expect(base.findTotaisPorAssociacao).not.toHaveBeenCalled();
    });
  });
});
