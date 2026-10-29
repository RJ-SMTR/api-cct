import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import { RelatorioNovoRemessaFinancialMovementService } from './relatorio-novo-remessa-financial-movement.service';
import { RelatorioGuardadorFinancialMovementRepository } from './relatorio-guardador-financial-movement.repository';

const BASE_EXPORT_ROW = {
  dataReferencia: '01/01/2026',
  dataPagamento: '05/01/2026',
  nomes: 'TESTE',
  email: 'teste@email.com',
  codBanco: '001',
  nomeBanco: 'BB',
  cpfCnpj: '123',
  consorcio: 'STPC',
  valor: 100,
  status: 'Pago',
  descricaoErro: '',
};

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

  it('formats the valor column with a comma decimal separator in the CSV export', async () => {
    jest.spyOn(service, 'streamFinancialMovementRows').mockImplementation(async (filter, onRow) => {
      await onRow({ ...BASE_EXPORT_ROW, valor: 150.5 } as any);
    });

    const response = await service.downloadFinancialMovementExport({
      dataInicio: new Date('2026-04-01'),
      dataFim: new Date('2026-04-22'),
    } as any);

    const [, line] = fs.readFileSync(response.filePath, 'utf8').trim().split('\n');
    expect(line).toContain(';150,5;');

    await service.removeGeneratedExportFile(response.filePath);
  });

  it.each(['xlsx', 'pdf'] as const)('generates a %s export file when requested', async (format) => {
    jest.spyOn(service, 'streamFinancialMovementRows').mockImplementation(async (filter, onRow) => {
      await onRow({ ...BASE_EXPORT_ROW } as any);
    });

    const response = await service.downloadFinancialMovementExport({
      dataInicio: new Date('2026-04-01'),
      dataFim: new Date('2026-04-22'),
      format,
    } as any);

    expect(response.filename.endsWith(`.${format}`)).toBe(true);
    expect(fs.existsSync(response.filePath)).toBe(true);
    expect(fs.statSync(response.filePath).size).toBeGreaterThan(0);

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

  describe('Eleição filter', () => {
    // Único marcador presente nas consultas do fluxo normal (buildBaseQuery/Pendencia Paga/
    // Pendentes), ausentes em buildEleicaoQuery (que parte de ordem_pagamento_agrupado, sem
    // juntar ordem_pagamento).
    const BASE_FLOW_MARKER = 'FROM ordem_pagamento op';
    // Único marcador da fonte de Eleição (ordem_pagamento_unico).
    const ELEICAO_MARKER = 'ordem_pagamento_unico';

    // Achado testando contra produção (19/10/2026, Eleição + Pago): o relatório misturava
    // lançamentos do fluxo normal (buildBaseQuery) - que não têm nenhuma relação com a Eleição -
    // sempre que algum status também era selecionado. Eleição é uma fonte própria; selecioná-la
    // deve trazer só o que vem dela, com ou sem status junto no filtro.
    it('brings only Eleição rows when a status is selected together with Eleição', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-10-19'),
        dataFim: new Date('2026-10-19'),
        eleicao: true,
        pago: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(ELEICAO_MARKER);
      expect(countQuery).not.toContain(BASE_FLOW_MARKER);
    });

    it('keeps bringing only Eleição rows when no status is selected (no regression)', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-10-19'),
        dataFim: new Date('2026-10-19'),
        eleicao: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(ELEICAO_MARKER);
      expect(countQuery).not.toContain(BASE_FLOW_MARKER);
    });

    it('does not bring Eleição rows when it was not selected', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-10-19'),
        dataFim: new Date('2026-10-19'),
        pago: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(BASE_FLOW_MARKER);
      expect(countQuery).not.toContain(ELEICAO_MARKER);
    });
  });

  describe('Favorecido: nenhum selecionado se comporta como Todos (ADR 0014)', () => {
    // NOT_CPF_FILTER exclui das consultas os 6 CNPJs dos próprios consórcios (favorecidos que
    // representam o consórcio inteiro, não um vanzeiro individual); só entrava com "Todos"
    // marcado explicitamente - sem nenhuma seleção (nem userIds, nem "Todos"), esses CNPJs
    // apareciam misturados com os vanzeiros individuais, resultado diferente de marcar "Todos".
    const NOT_CPF_FILTER_MARKER = 'cpfCnpj" NOT IN';

    it('applies the same CNPJ exclusion with nothing selected as with "Todos" explicitly marked', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-10-19'),
        dataFim: new Date('2026-10-19'),
        pago: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(NOT_CPF_FILTER_MARKER);
    });

    it('keeps applying the exclusion when "Todos" is marked explicitly (no regression)', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-10-19'),
        dataFim: new Date('2026-10-19'),
        pago: true,
        todosVanzeiros: true,
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).toContain(NOT_CPF_FILTER_MARKER);
    });

    it('does not apply the exclusion when a specific favorecido is selected', async () => {
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-10-19'),
        dataFim: new Date('2026-10-19'),
        pago: true,
        userIds: [10],
      } as any);

      const [countQuery] = dataSource.query.mock.calls[0];
      expect(countQuery).not.toContain(NOT_CPF_FILTER_MARKER);
    });
  });

  describe('STUC - Gratuidade filter', () => {
    const PENDENTES_MARKER = 'op."ordemPagamentoAgrupadoId" IS NULL';

    it('reads ordem_pagamento.valorGratuidade through the gratuidade grouping', async () => {
      // findFinancialMovementSummary(STUC) agrega em memória a partir das linhas pivotadas
      // (ver findStucGratuidadePivotedRows), então só há 1 query - a das linhas por dia.
      dataSource.query.mockResolvedValueOnce([]);
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
        stucGratuidade: true,
        pago: true,
      } as any);

      const [dataQuery] = dataSource.query.mock.calls[0];
      expect(dataQuery).toContain('op."valorGratuidade"');
      expect(dataQuery).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
    });

    // Bug (achado testando contra produção, 2026-10-27): "dataReferencia" aqui é
    // DATE(op."dataOrdem") (ver AGRUPAMENTO_GRATUIDADE), uma coluna "date" pura, sem hora - girar
    // essa meia-noite por AT TIME ZONE 'America/Sao_Paulo' empurra pro dia anterior. Favorecido
    // ABDON ALVIM DE QUEIROZ: janela 13-15/10/2026 aparecia como 12-14/10 só na Movimentação
    // Financeira; o Consolidado (que não converte) mostrava a data correta.
    it('does not convert "dataReferencia" through AT TIME ZONE (it is a plain date, DATE(op."dataOrdem"), not a timestamp)', async () => {
      dataSource.query.mockResolvedValueOnce([]);
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-10-16'),
        dataFim: new Date('2026-10-16'),
        stucGratuidade: true,
        pago: true,
      } as any);

      const [dataQuery] = dataSource.query.mock.calls[0];
      expect(dataQuery).toContain(`to_char(g."dataReferencia",'DD/MM/YYYY') AS "dataReferencia"`);
      expect(dataQuery).not.toMatch(/"dataReferencia"\s+AT TIME ZONE/);
      // dataPagamento continua vindo de um TIMESTAMP real (ordem_pagamento_agrupado) - a
      // conversão nele permanece intocada.
      expect(dataQuery).toContain(`to_char(g."dataPagamento" AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY') AS "dataPagamento"`);
    });

    // O fluxo normal usa detalhe_a."dataVencimento" (um TIMESTAMP real) como "dataReferencia" -
    // a conversão de timezone aqui é intencional e não deve regredir com o fix acima.
    it('keeps converting "dataReferencia" through AT TIME ZONE for the non-STUC flow (a real TIMESTAMP, detalhe_a."dataVencimento")', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{}]);

      await service.findFinancialMovementPage({
        dataInicio: new Date('2026-10-16'),
        dataFim: new Date('2026-10-16'),
        page: 1,
        pageSize: 50,
        pago: true,
      } as any);

      const [dataQuery] = dataSource.query.mock.calls[0];
      expect(dataQuery).toContain(`to_char(g."dataReferencia" AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY') AS "dataReferencia"`);
    });

    it('never includes the Pendentes/OPs atrasadas query, even without a restrictive status filter', async () => {
      dataSource.query.mockResolvedValueOnce([]);
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
        stucGratuidade: true,
      } as any);

      const [dataQuery] = dataSource.query.mock.calls[0];
      expect(dataQuery).not.toContain(PENDENTES_MARKER);
    });

    it('includes Pendencia Paga filtered by payment date, following the gratuidade grouping', async () => {
      dataSource.query.mockResolvedValueOnce([]);
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-22'),
        stucGratuidade: true,
        pendenciaPaga: true,
      } as any);

      const [dataQuery] = dataSource.query.mock.calls[0];
      expect(dataQuery).toContain('opa."dataPagamento"::date BETWEEN $1::date AND $2::date');
      expect(dataQuery).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
    });

    it('includes Pendencia de Pagamento in a single day through the parent attempt, following the gratuidade grouping', async () => {
      dataSource.query.mockResolvedValueOnce([]);
      await service.findFinancialMovementSummary({
        dataInicio: new Date('2026-04-01'),
        dataFim: new Date('2026-04-01'),
        stucGratuidade: true,
        pendenciaPaga: true,
        estorno: true,
      } as any);

      const [dataQuery] = dataSource.query.mock.calls[0];
      expect(dataQuery).toContain('oph_pai');
      expect(dataQuery).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
    });
  });

  describe('STUC - Gratuidade payment window columns (ADR 0012)', () => {
    const DAY_ROW = {
      dataPagamento: '27/10/2026',
      nomes: 'FULANO',
      email: 'fulano@email.com',
      codBanco: '001',
      nomeBanco: 'BB',
      cpfCnpj: '12345678900',
      consorcio: 'Consorcio A',
      status: 'Pago',
      codigoErro: null,
    };

    it('pivots a complete 4-day window into one row with the 4 pairs filled and valor summed', async () => {
      dataSource.query.mockResolvedValueOnce([
        { ...DAY_ROW, dataReferencia: '23/10/2026', valor: 10 },
        { ...DAY_ROW, dataReferencia: '24/10/2026', valor: 20 },
        { ...DAY_ROW, dataReferencia: '25/10/2026', valor: 30 },
        { ...DAY_ROW, dataReferencia: '26/10/2026', valor: 40 },
      ]);

      const page = await service.findFinancialMovementPage({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-26'),
        stucGratuidade: true,
        page: 1,
        pageSize: 50,
      } as any);

      expect(page.data).toHaveLength(1);
      const [row] = page.data as any[];
      expect(row.dataOrdemPagamento1).toBe('23/10/2026');
      expect(row.valorOrdemPagamento1).toBe(10);
      expect(row.dataOrdemPagamento2).toBe('24/10/2026');
      expect(row.valorOrdemPagamento2).toBe(20);
      expect(row.dataOrdemPagamento3).toBe('25/10/2026');
      expect(row.valorOrdemPagamento3).toBe(30);
      expect(row.dataOrdemPagamento4).toBe('26/10/2026');
      expect(row.valorOrdemPagamento4).toBe(40);
      expect(row.valor).toBe(100);
    });

    it('leaves the 4th pair empty for a 3-day (Tue-Thu) window', async () => {
      dataSource.query.mockResolvedValueOnce([
        { ...DAY_ROW, dataReferencia: '27/10/2026', valor: 1 },
        { ...DAY_ROW, dataReferencia: '28/10/2026', valor: 2 },
        { ...DAY_ROW, dataReferencia: '29/10/2026', valor: 3 },
      ]);

      const page = await service.findFinancialMovementPage({
        dataInicio: new Date('2026-10-27'),
        dataFim: new Date('2026-10-29'),
        stucGratuidade: true,
        page: 1,
        pageSize: 50,
      } as any);

      const [row] = page.data as any[];
      expect(row.dataOrdemPagamento3).toBe('29/10/2026');
      expect(row.dataOrdemPagamento4).toBeFalsy();
      expect(row.valorOrdemPagamento4).toBeFalsy();
      expect(row.valor).toBe(6);
    });

    it('splits two different payment windows for the same favorecido into two rows', async () => {
      dataSource.query.mockResolvedValueOnce([
        { ...DAY_ROW, dataReferencia: '23/10/2026', valor: 10 },
        { ...DAY_ROW, dataReferencia: '27/10/2026', valor: 20 },
      ]);

      const page = await service.findFinancialMovementPage({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-29'),
        stucGratuidade: true,
        page: 1,
        pageSize: 50,
      } as any);

      expect(page.data).toHaveLength(2);
      expect((page.data as any[]).map((r) => r.valor).sort()).toEqual([10, 20]);
    });

    it('groups a Pendencia de Pagamento row (no dataPagamento) by the window derived from its dataReferencia', async () => {
      dataSource.query.mockResolvedValueOnce([
        { ...DAY_ROW, dataPagamento: null, status: 'Rejeitado', dataReferencia: '23/10/2026', valor: 15 },
      ]);

      const page = await service.findFinancialMovementPage({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-23'),
        stucGratuidade: true,
        page: 1,
        pageSize: 50,
      } as any);

      const [row] = page.data as any[];
      expect(row.dataOrdemPagamento1).toBe('23/10/2026');
      expect(row.valorOrdemPagamento1).toBe(15);
    });

    it('paginates the pivoted rows in memory without dropping or duplicating windows across pages', async () => {
      // findFinancialMovementPage(STUC) faz 1 query por chamada (não há cache entre
      // page1/page2), então cada chamada precisa do seu próprio mock com as mesmas linhas.
      const dayRows = [
        { ...DAY_ROW, cpfCnpj: '1', dataReferencia: '23/10/2026', valor: 10 },
        { ...DAY_ROW, cpfCnpj: '2', dataReferencia: '23/10/2026', valor: 20 },
        { ...DAY_ROW, cpfCnpj: '3', dataReferencia: '23/10/2026', valor: 30 },
      ];
      dataSource.query
        .mockResolvedValueOnce(dayRows)
        .mockResolvedValueOnce(dayRows);

      const filter = {
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-23'),
        stucGratuidade: true,
        pageSize: 2,
      } as any;

      const page1 = await service.findFinancialMovementPage({ ...filter, page: 1 });
      const page2 = await service.findFinancialMovementPage({ ...filter, page: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(1);
      const allCpfCnpj = [...(page1.data as any[]), ...(page2.data as any[])].map((r) => r.cpfCnpj).sort();
      expect(allCpfCnpj).toEqual(['1', '2', '3']);

      // Regressão: nextCursor fixo em null deixava a seta de "próxima página" sempre
      // desabilitada no front, mesmo havendo mais linhas além da página atual.
      expect(page1.nextCursor).toBeTruthy();
      expect(page2.nextCursor).toBeNull();
    });

    it('orders rows by nomes and, within the same nomes, by dataPagamento (ascending)', async () => {
      dataSource.query.mockResolvedValueOnce([
        // Zeca tem duas janelas de pagamento distintas: a mais recente (23/10) vem primeiro na
        // query bruta, mas deve aparecer depois da mais antiga (16/10) uma vez ordenado.
        { ...DAY_ROW, nomes: 'Zeca', cpfCnpj: '1', dataReferencia: '20/10/2026', dataPagamento: '23/10/2026', dataPagamentoCursor: '2026-10-23T00:00:00', valor: 10 },
        { ...DAY_ROW, nomes: 'Zeca', cpfCnpj: '1', dataReferencia: '13/10/2026', dataPagamento: '16/10/2026', dataPagamentoCursor: '2026-10-16T00:00:00', valor: 20 },
        { ...DAY_ROW, nomes: 'Ana', cpfCnpj: '2', dataReferencia: '13/10/2026', dataPagamento: '16/10/2026', dataPagamentoCursor: '2026-10-16T00:00:00', valor: 30 },
      ]);

      const page = await service.findFinancialMovementPage({
        dataInicio: new Date('2026-10-13'),
        dataFim: new Date('2026-10-20'),
        stucGratuidade: true,
        page: 1,
        pageSize: 50,
      } as any);

      expect((page.data as any[]).map((r) => [r.nomes, r.dataPagamento])).toEqual([
        ['Ana', '16/10/2026'],
        ['Zeca', '16/10/2026'],
        ['Zeca', '23/10/2026'],
      ]);
    });

    it('explodes each day of the window into its own exported row, like the screen and the Consolidado export do', async () => {
      dataSource.query.mockResolvedValueOnce([
        { ...DAY_ROW, dataReferencia: '23/10/2026', valor: 10 },
        { ...DAY_ROW, dataReferencia: '24/10/2026', valor: 20 },
      ]);

      const rows: any[] = [];
      await service.streamFinancialMovementRows(
        { dataInicio: new Date('2026-10-23'), dataFim: new Date('2026-10-24'), stucGratuidade: true } as any,
        (row) => { rows.push(row); },
      );

      expect(rows).toHaveLength(2);
      // "Data Referência"/"Valor" exportados são os do dia; "Data Pagamento" (a janela) se repete.
      expect(rows[0].dataReferencia).toBe('23/10/2026');
      expect(rows[0].valor).toBe(10);
      expect(rows[1].dataReferencia).toBe('24/10/2026');
      expect(rows[1].valor).toBe(20);
      expect(rows[0].dataPagamento).toBe(rows[1].dataPagamento);
      // "valorLancamento" preserva o total da janela (10+20=30) nas duas linhas, igual à tela -
      // sem ele, o export STUC (financial-movement-export-writer.ts) perderia a coluna "Valor
      // Lançamento" ao sobrescrever "valor" acima com o valor do dia.
      expect(rows[0].valorLancamento).toBe(30);
      expect(rows[1].valorLancamento).toBe(30);
    });

    it('filters by Valor Lançamento (the pivoted window total), not by a single day value', async () => {
      // FULANO: dias de 10+20+30 = 60 (passa min=50). CICLANO: só um dia de 15 (não passa
      // min=50, mesmo tendo um dia isolado de 15 que por si só ficaria entre min/max se o
      // filtro fosse aplicado por dia em vez de pela janela pivotada).
      dataSource.query.mockResolvedValueOnce([
        { ...DAY_ROW, cpfCnpj: '1', dataReferencia: '23/10/2026', valor: 10 },
        { ...DAY_ROW, cpfCnpj: '1', dataReferencia: '24/10/2026', valor: 20 },
        { ...DAY_ROW, cpfCnpj: '1', dataReferencia: '25/10/2026', valor: 30 },
        { ...DAY_ROW, cpfCnpj: '2', dataReferencia: '23/10/2026', valor: 15 },
      ]);

      const page = await service.findFinancialMovementPage({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-25'),
        stucGratuidade: true,
        valorMin: 50,
        valorMax: 100,
        page: 1,
        pageSize: 50,
      } as any);

      expect(page.data).toHaveLength(1);
      expect((page.data as any[])[0].cpfCnpj).toBe('1');
      expect((page.data as any[])[0].valor).toBe(60);
      expect(page.count).toBe(1);
      expect(page.valorTotal).toBe(60);
    });

    it('respects both valorMin and valorMax together when filtering by Valor Lançamento', async () => {
      dataSource.query.mockResolvedValueOnce([
        { ...DAY_ROW, cpfCnpj: '1', dataReferencia: '23/10/2026', valor: 10 },
        { ...DAY_ROW, cpfCnpj: '2', dataReferencia: '23/10/2026', valor: 50 },
        { ...DAY_ROW, cpfCnpj: '3', dataReferencia: '23/10/2026', valor: 200 },
      ]);

      const page = await service.findFinancialMovementPage({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-23'),
        stucGratuidade: true,
        valorMin: 20,
        valorMax: 100,
        page: 1,
        pageSize: 50,
      } as any);

      expect((page.data as any[]).map((r) => r.cpfCnpj)).toEqual(['2']);
    });
  });
});
