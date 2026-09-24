import { DataSource, QueryRunner } from 'typeorm';
import { RelatorioNovoRemessaMovimentacaoRepository } from './relatorio-novo-remessa-movimentacao.repository';

describe('RelatorioNovoRemessaMovimentacaoRepository — consorcio grouping', () => {
  let repository: RelatorioNovoRemessaMovimentacaoRepository;
  let mockQueryRunner: Partial<QueryRunner>;
  let mockDataSource: Partial<DataSource>;

  beforeAll(() => {
    (global as any).__localTzOffset = 0;
  });

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn()
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([]),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner as QueryRunner),
    };

    repository = new RelatorioNovoRemessaMovimentacaoRepository(mockDataSource as DataSource);
  });

  const runAndCaptureQueries = async (
    consorcioNome?: string[],
    todosConsorcios?: boolean,
    extraFilter: Record<string, unknown> = {},
  ) => {
    await repository.findMovimentacao({
      dataInicio: new Date('2026-07-01'),
      dataFim: new Date('2026-09-22'),
      consorcioNome,
      todosConsorcios,
      pago: true,
      ...extraFilter,
    } as any);

    const [aggQuery, dataQuery] = (mockQueryRunner.query as jest.Mock).mock.calls.map((call) => call[0]);
    return { aggQuery, dataQuery };
  };

  // Any consorcio selection — a modal (STPC/STPL/TEC/VLT) or a real consórcio (Internorte,
  // Santa Cruz...) — now shows one row per date/status with the sum of everyone under it,
  // not one row per vanzeiro.
  it.each([
    ['STPC', 'a modal'],
    ['Internorte', 'a real consórcio'],
  ])('groups by date and status, summing valor, when %s (%s) is selected', async (consorcio) => {
    const { aggQuery, dataQuery } = await runAndCaptureQueries([consorcio]);

    expect(aggQuery).toContain('COUNT(DISTINCT ("dataReferencia", consorcio, status)) AS total');
    expect(dataQuery).toContain('GROUP BY "dataReferencia", consorcio, status');
    expect(dataQuery).toContain('SUM(valor) AS valor');
    expect(dataQuery).toContain('consorcio AS nomes');
  });

  it('groups everything when "Todos" (todosConsorcios) is selected', async () => {
    const { aggQuery, dataQuery } = await runAndCaptureQueries(undefined, true);

    expect(aggQuery).toContain('COUNT(DISTINCT ("dataReferencia", consorcio, status)) AS total');
    expect(dataQuery).toContain('GROUP BY "dataReferencia", consorcio, status');
  });

  // STPC/STPL/TEC/VLT are derived from pu."permitCode", but op."nomeConsorcio" (what the old
  // filter matched against) disagrees with that derivation for a slice of rows in production —
  // matching permitCode keeps what is filtered consistent with what is grouped/labeled.
  it('filters modais by the permitCode-derived value instead of the raw nomeConsorcio column', async () => {
    const { aggQuery } = await runAndCaptureQueries(['STPC']);

    expect(aggQuery).toContain(`pu."permitCode" LIKE '4%'`);
    expect(aggQuery).not.toContain(`op."nomeConsorcio" IN('STPC')`);
  });

  it('matches VLT by permitCode too', async () => {
    const { aggQuery } = await runAndCaptureQueries(['VLT']);

    expect(aggQuery).toContain(`pu."permitCode" = '8'`);
  });

  // A real consórcio has no permitCode rule — its own row IS the raw nomeConsorcio column,
  // so that stays the match for it.
  it('filters a real consórcio by the raw nomeConsorcio column', async () => {
    const { dataQuery } = await runAndCaptureQueries(['Internorte']);

    expect(dataQuery).toContain(`op."nomeConsorcio" IN('Internorte')`);
  });

  it('combines a modal and a real consórcio with OR when both are selected together', async () => {
    const { aggQuery } = await runAndCaptureQueries(['STPC', 'Internorte']);

    expect(aggQuery).toContain(`pu."permitCode" LIKE '4%'`);
    expect(aggQuery).toContain(`op."nomeConsorcio" IN('Internorte')`);
  });

  it('matches every selected modal when more than one is chosen', async () => {
    const { aggQuery } = await runAndCaptureQueries(['STPC', 'TEC', 'VLT']);

    expect(aggQuery).toContain(`pu."permitCode" LIKE '4%'`);
    expect(aggQuery).toContain(`pu."permitCode" LIKE '7%'`);
    expect(aggQuery).toContain(`pu."permitCode" = '8'`);
  });

  it('does not group when the vanzeiro filter is used instead of the consorcio filter', async () => {
    const { aggQuery, dataQuery } = await runAndCaptureQueries(undefined, undefined, { todosVanzeiros: true });

    expect(aggQuery).toContain('COUNT(*) AS total');
    expect(dataQuery).not.toContain('GROUP BY "dataReferencia", consorcio, status');
  });
  // Each selected status widens the result set: they must be OR-ed together. AND-ing them
  // (e.g. the erro "motivo NOT IN 00/0BD" on top of pago) wiped out every Pago row.
  describe('status combination', () => {
    const PAGO = `oph."statusRemessa" = 3`;
    const ERRO = `(oph."statusRemessa" = 4 AND oph."motivoStatusRemessa" NOT IN ('00','0BD'))`;

    it('ORs pago and erro instead of restricting Pago rows by the erro motivo', async () => {
      const { aggQuery, dataQuery } = await runAndCaptureQueries(undefined, true, { erro: true });

      for (const query of [aggQuery, dataQuery]) {
        expect(query).toContain(`AND (${PAGO} OR ${ERRO})`);
        expect(query).not.toMatch(/AND \(oph\."motivoStatusRemessa" NOT IN \('00','0BD'\)\)/);
      }
    });

    it('ORs pago and estorno instead of restricting Pago rows to motivo 02', async () => {
      const { aggQuery } = await runAndCaptureQueries(undefined, true, { estorno: true });

      expect(aggQuery).toContain(`AND (${PAGO} OR oph."motivoStatusRemessa" IN ('02'))`);
    });

    it('keeps estorno when estorno and rejeitado are selected together', async () => {
      const { aggQuery } = await runAndCaptureQueries(undefined, true, {
        pago: false,
        estorno: true,
        rejeitado: true,
      });

      expect(aggQuery).toContain(
        `AND (oph."motivoStatusRemessa" IN ('02') OR oph."motivoStatusRemessa" NOT IN ('00','0BD','02'))`,
      );
    });

    it('filters only by the selected status when a single one is chosen', async () => {
      const { aggQuery } = await runAndCaptureQueries(undefined, true, { pago: true });

      expect(aggQuery).toContain(`AND (${PAGO})`);
      expect(aggQuery).not.toContain(`${PAGO} OR`);
      expect(aggQuery).not.toContain(`NOT IN ('00','0BD')`);
    });
  });
});
