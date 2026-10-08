import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import { RelatorioNovoRemessaFinancialMovementRepository } from './relatorio-novo-remessa-financial-movement.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './relatorio-novo-remessa-financial-movement.service';
import { RelatorioGuardadorFinancialMovementRepository } from './relatorio-guardador-financial-movement.repository';

describe('RelatorioNovoRemessaFinancialMovementService', () => {
  let service: RelatorioNovoRemessaFinancialMovementService;
  let guardadorRepo: RelatorioGuardadorFinancialMovementRepository;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatorioNovoRemessaFinancialMovementService,
        {
          provide: getDataSourceToken(),
          useValue: { query: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { query: jest.fn() },
        },
        {
          provide: RelatorioGuardadorFinancialMovementRepository,
          useValue: {
            findFinancialMovementSummary: jest.fn(),
            findFinancialMovementPage: jest.fn(),
            streamFinancialMovementRows: jest.fn(),
          },
        },
        {
          provide: RelatorioNovoRemessaFinancialMovementRepository,
          useValue: {
            findFinancialMovementSummary: jest.fn(),
            findFinancialMovementPage: jest.fn(),
            streamFinancialMovementRows: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RelatorioNovoRemessaFinancialMovementService>(
      RelatorioNovoRemessaFinancialMovementService,
    );
    guardadorRepo = module.get<RelatorioGuardadorFinancialMovementRepository>(
      RelatorioGuardadorFinancialMovementRepository,
    );
    dataSource = module.get(getDataSourceToken());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a direct-download export file for permissionarios', async () => {
    jest.spyOn(service, 'streamFinancialMovementRows').mockImplementation(async (filter, onRow) => {
      await onRow({
        dataReferencia: '01/01/2026',
        dataPagamento: '05/01/2026',
        nomes: 'TESTE',
        email: 'teste@email.com',
        codBanco: '001',
        nomeBanco: 'BB',
        cpfCnpj: '123',
        consorcio: 'STPC',
        valor: 100,
        status: 'Rejeitado',
        descricaoErro: 'Agência/Conta corrente/DV inválido',
      } as any);
    });

    const response = await service.downloadFinancialMovementExport({
      dataInicio: new Date('2026-04-01'),
      dataFim: new Date('2026-04-22'),
    } as any);

    expect(response.contentType).toBe('text/csv; charset=utf-8');
    expect(response.filename).toContain('financial-movement-');
    expect(fs.existsSync(response.filePath)).toBe(true);

    const [header, line] = fs.readFileSync(response.filePath, 'utf8').trim().split('\n');
    expect(header.endsWith(';status;descricaoErro')).toBe(true);
    expect(line.endsWith(';Rejeitado;"Agência/Conta corrente/DV inválido"')).toBe(true);

    await service.removeGeneratedExportFile(response.filePath);
  });

  it('generates a direct-download export file for guardadores', async () => {
    jest
      .spyOn(guardadorRepo, 'streamFinancialMovementRows')
      .mockImplementation(async (filter, onRow) => {
        await onRow({
          dataReferencia: '01/01/2026',
          dataPagamento: '05/01/2026',
          nomes: 'GUARDADOR TESTE',
          email: 'g@email.com',
          codBanco: '001',
          nomeBanco: 'BB',
          cpfCnpj: '456',
          consorcio: 'Guardador Autônomo',
          valor: 200,
          status: 'Pago',
        } as any);
      });

    const response = await service.downloadGuardadorFinancialMovementExport({
      dataInicio: new Date('2026-04-01'),
      dataFim: new Date('2026-04-22'),
    } as any);

    expect(response.contentType).toBe('text/csv; charset=utf-8');
    expect(response.filename).toContain('financial-movement-guardadores-');
    expect(fs.existsSync(response.filePath)).toBe(true);

    // A row without an error keeps the description empty, so the column stays aligned.
    const [header, line] = fs.readFileSync(response.filePath, 'utf8').trim().split('\n');
    expect(header.endsWith(';status;descricaoErro')).toBe(true);
    expect(line.endsWith(';Pago;""')).toBe(true);

    await service.removeGeneratedExportFile(response.filePath);
  });

  describe('findFinancialMovementPage tie-breaker cursor', () => {
    it('orders and filters the keyset by the full tie-breaker tuple, not just the original 4 columns', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{}]);

      await service.findFinancialMovementPage({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        page: 1,
        pageSize: 50,
        cursorDataReferencia: '01/01/2026',
        cursorNome: 'FULANO',
        cursorStatus: 'Pago',
        cursorCpfCnpj: '12345678900',
        cursorNomeConsorcio: 'Consorcio A',
        cursorCodBanco: '001',
        cursorDataPagamento: '2026-01-05T00:00:00',
        cursorEmail: 'fulano@email.com',
      } as any);

      const [dataQuery, dataParams] = dataSource.query.mock.calls[0];
      expect(dataQuery).toContain('"nomeConsorcio"');
      expect(dataQuery).toContain('"codBanco"');
      expect(dataQuery).toContain('"dataPagamento"');
      expect(dataQuery).toContain('g.email');
      expect(dataParams).toContain('Consorcio A');
      expect(dataParams).toContain('001');
      expect(dataParams).toContain('2026-01-05T00:00:00');
      expect(dataParams).toContain('fulano@email.com');
    });

    it('builds the next page cursor from the full tuple, so a tied group is not cut mid-way', async () => {
      // Two grouped rows tied on the old 4 columns (dataReferencia/nomes/status/cpfCnpj),
      // differing only by nomeConsorcio - exactly the case the old cursor would lose.
      dataSource.query
        .mockResolvedValueOnce([
          {
            dataReferencia: '01/01/2026',
            dataPagamento: '05/01/2026',
            dataPagamentoCursor: '2026-01-05T00:00:00',
            nomes: 'FULANO',
            email: 'fulano@email.com',
            codBanco: '001',
            nomeBanco: 'BB',
            cpfCnpj: '12345678900',
            consorcio: 'Consorcio A',
            valor: 100,
            status: 'Pago',
          },
          {
            dataReferencia: '01/01/2026',
            dataPagamento: '05/01/2026',
            dataPagamentoCursor: '2026-01-05T00:00:00',
            nomes: 'FULANO',
            email: 'fulano@email.com',
            codBanco: '002',
            nomeBanco: 'Itau',
            cpfCnpj: '12345678900',
            consorcio: 'Consorcio B',
            valor: 50,
            status: 'Pago',
          },
        ])
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([{}]);

      const page = await service.findFinancialMovementPage({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        page: 1,
        pageSize: 2,
      } as any);

      // The old cursor (4 columns) would be identical for both tied rows, so the next
      // page's WHERE clause would exclude row 2 as well as everything after it.
      expect(page.nextCursor).toMatchObject({
        dataReferencia: '01/01/2026',
        nomes: 'FULANO',
        status: 'Pago',
        cpfCnpj: '12345678900',
        nomeConsorcio: 'Consorcio B',
        codBanco: '002',
        dataPagamento: '2026-01-05T00:00:00',
        email: 'fulano@email.com',
      });
    });

    it('carries tie-breakers across export batches (streamFinancialMovementRows), not just the original 4 columns', async () => {
      // streamFinancialMovementRows batches in groups of 500 (hardcoded); fill the first
      // batch to force a second call, and make its last row the one whose tie-breakers
      // must seed the next batch's cursor.
      const baseRow = {
        dataReferencia: '01/01/2026',
        dataPagamento: '05/01/2026',
        dataPagamentoCursor: '2026-01-05T00:00:00',
        nomes: 'FULANO',
        email: 'fulano@email.com',
        codBanco: '001',
        nomeBanco: 'BB',
        cpfCnpj: '12345678900',
        consorcio: 'Consorcio A',
        valor: 100,
        status: 'Pago',
      };
      const lastRowOfFirstBatch = {
        ...baseRow,
        consorcio: 'Consorcio Z',
        codBanco: '999',
        email: 'z@email.com',
      };
      const firstBatch = [...Array.from({ length: 499 }, () => baseRow), lastRowOfFirstBatch];

      dataSource.query.mockResolvedValueOnce(firstBatch).mockResolvedValueOnce([]);

      const onRow = jest.fn();
      await service.streamFinancialMovementRows(
        { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-01-05') } as any,
        onRow,
      );

      expect(onRow).toHaveBeenCalledTimes(500);
      expect(dataSource.query).toHaveBeenCalledTimes(2);

      // The second batch call's cursor must carry the first batch's last-row tie-breakers,
      // not just the 4 columns shared with every other row in the batch.
      const [, secondBatchParams] = dataSource.query.mock.calls[1];
      expect(secondBatchParams).toContain('Consorcio Z');
      expect(secondBatchParams).toContain('999');
      expect(secondBatchParams).toContain('z@email.com');
    });

    it('still filters by the keyset when the cursor has no payment date (row not paid yet)', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{}]);

      await service.findFinancialMovementPage({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        page: 1,
        pageSize: 50,
        cursorDataReferencia: '01/01/2026',
        cursorNome: 'FULANO',
        cursorStatus: 'A Pagar',
        cursorCpfCnpj: '12345678900',
        // cursorNomeConsorcio/cursorCodBanco/cursorDataPagamento/cursorEmail intentionally
        // absent: a row that has not been paid yet has no dataPagamento tie-breaker value.
      } as any);

      const [dataQuery, dataParams] = dataSource.query.mock.calls[0];
      expect(dataQuery).toContain("COALESCE(to_char(g.\"dataPagamento\", 'YYYY-MM-DD\"T\"HH24:MI:SS'), '')");
      expect(dataParams).toContain(null);
    });

    it('resolves a cursor from an old client sending only the original 4 columns', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{}]);

      await expect(
        service.findFinancialMovementPage({
          dataInicio: new Date('2026-01-01'),
          dataFim: new Date('2026-01-05'),
          page: 1,
          pageSize: 50,
          cursorDataReferencia: '01/01/2026',
          cursorNome: 'FULANO',
          cursorStatus: 'Pago',
          cursorCpfCnpj: '12345678900',
        } as any),
      ).resolves.not.toThrow();

      const [, dataParams] = dataSource.query.mock.calls[0];
      expect(dataParams).toEqual(expect.arrayContaining(['01/01/2026', 'FULANO', 'Pago', '12345678900']));
    });
  });

  describe('Pendencia Paga status filter', () => {
    // Trecho exclusivo da sub-consulta de Pendencia Paga (buildPendenciaPagaSingleDateQuery):
    // filtra pela data de pagamento da própria OPA, não da "pai".
    const PENDENCIA_PAGA_MARKER = 'opa."dataPagamento"::date BETWEEN $1::date AND $2::date';

    it('includes Pendencia Paga filtered by payment date even over a multi-day range', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
        pendenciaPaga: true,
        pago: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(PENDENCIA_PAGA_MARKER);
    });

    it('keeps including Pendencia Paga when the range is a single day (no regression)', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-01'),
        pendenciaPaga: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(PENDENCIA_PAGA_MARKER);
    });

    it('does not include Pendencia Paga when it was not selected', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
        pago: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).not.toContain(PENDENCIA_PAGA_MARKER);
    });

    it('still requires a single day for Estorno/Rejeitado while Pendencia Paga uses the full range', async () => {
      // Alias exclusivo de buildPendenciaPagamentoSingleDateQuery (join com o histórico mais recente da "pai").
      const PENDENCIA_PAGAMENTO_MARKER = 'oph_pai';

      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
        pendenciaPaga: true,
        estorno: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(PENDENCIA_PAGA_MARKER);
      expect(countQuery).not.toContain(PENDENCIA_PAGAMENTO_MARKER);
    });
  });
});
