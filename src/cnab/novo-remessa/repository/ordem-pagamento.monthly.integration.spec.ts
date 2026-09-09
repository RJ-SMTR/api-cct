/**
 * Disposable local PostgreSQL, no application bootstrap or production credentials.
 * MONTHLY_REPORT_TEST_PORT=55439 npx jest ordem-pagamento.monthly.integration --runInBand
 */
import { DataSource, Repository } from 'typeorm';
import { OrdemPagamentoRepository } from './ordem-pagamento.repository';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';

const suite = process.env.MONTHLY_REPORT_TEST_PORT ? describe : describe.skip;

suite('Monthly consortium capture allocations (PostgreSQL)', () => {
  let ds: DataSource;
  let runner: ReturnType<DataSource['createQueryRunner']>;
  let repository: OrdemPagamentoRepository;

  beforeAll(async () => {
    ds = await new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: Number(process.env.MONTHLY_REPORT_TEST_PORT),
      username: 'postgres',
      database: 'postgres',
      entities: [],
      synchronize: false,
    }).initialize();
    runner = ds.createQueryRunner();
    await runner.connect();
    await runner.query(`
      CREATE TEMP TABLE ordem_pagamento (
        id integer PRIMARY KEY, "userId" integer, "dataCaptura" timestamp,
        valor numeric(13,5), "ordemPagamentoAgrupadoId" integer
      );
      CREATE TEMP TABLE ordem_pagamento_agrupado (
        id integer PRIMARY KEY, "valorTotal" numeric(13,5), "dataPagamento" timestamp
      );
      CREATE TEMP TABLE ordem_pagamento_agrupado_historico (
        id integer PRIMARY KEY, "ordemPagamentoAgrupadoId" integer,
        "statusRemessa" integer, "motivoStatusRemessa" text
      );
      CREATE TEMP TABLE detalhe_a (
        id integer PRIMARY KEY, "ordemPagamentoAgrupadoHistoricoId" integer,
        "valorLancamento" numeric(13,5)
      );
    `);
    // Use a real TypeORM repository bound to the temporary-table session.
    const orders = new Repository<OrdemPagamento>(OrdemPagamento, runner.manager, runner);
    repository = new OrdemPagamentoRepository(orders, ds);
  });

  afterAll(async () => {
    if (runner) await runner.release();
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    await runner.query(`TRUNCATE pg_temp.ordem_pagamento,
      pg_temp.ordem_pagamento_agrupado,
      pg_temp.ordem_pagamento_agrupado_historico, pg_temp.detalhe_a`);
  });

  const monthly = (month = '2026-07-01') => repository.findOrdensPagamentoAgrupadasPorMes(2369, new Date(`${month}T00:00:00Z`));
  const day = (date: Date) => date.toISOString().slice(0, 10);

  it('allocates OPA 507491 to two windows and displays its ID only on July 10', async () => {
    await runner.query(`
      INSERT INTO ordem_pagamento_agrupado VALUES (507491, 3481.44, '2026-09-08');
      INSERT INTO ordem_pagamento_agrupado_historico VALUES (510441, 507491, 1, NULL);
      INSERT INTO detalhe_a VALUES (313774, 510441, 3481.44);
      INSERT INTO ordem_pagamento VALUES
        (843333, 2369, '2026-07-04 10:00', 586.56, 507491),
        (845813, 2369, '2026-07-05 10:00', 1406.88, 507491),
        (846538, 2369, '2026-07-06 10:00', 872.64, 507491),
        (847898, 2369, '2026-07-07 10:00', 615.36, 507491);
    `);
    const rows = (await monthly()).filter((row) => row.valorTotal);
    expect(rows.map((row) => ({ date: day(row.data), value: row.valorTotal, ids: row.ordemPagamentoAgrupadoIds, status: row.statusRemessa, paymentDate: day(row.dataPagamento) }))).toEqual([
      { date: '2026-07-10', value: 615.36, ids: '507491', status: 1, paymentDate: '2026-09-08' },
      { date: '2026-07-07', value: 2866.08, ids: null, status: 1, paymentDate: '2026-09-08' },
    ]);
  });

  it('allocates OPA 499621 across July and August but displays its ID only on August 4', async () => {
    await runner.query(`
      INSERT INTO ordem_pagamento_agrupado VALUES (499621, 32648.64, '2026-09-03');
      INSERT INTO ordem_pagamento_agrupado_historico VALUES (502432, 499621, 5, '00');
    `);
    const values = [1553.28, 1429.44, 1532.16, 1330.08, 1231.2, 752.16, 1377.6, 1520.64, 1006.56, 1420.8, 1303.68, 1056.48, 821.28, 848.64, 1169.76, 1133.28, 1377.6, 1261.44, 1166.4, 1166.88, 1037.28, 874.08, 1191.36, 1372.32, 1311.84, 1201.44, 1200.96];
    for (let i = 0; i < values.length; i++) {
      await runner.query(
        `INSERT INTO ordem_pagamento VALUES
        ($1, 2369, '2026-07-08 10:00'::timestamp + $2 * interval '1 day', $3, 499621)`,
        [i + 1, i, values[i]],
      );
    }
    const july = (await monthly()).filter((row) => row.valorTotal);
    const august = (await monthly('2026-08-01')).filter((row) => row.valorTotal);
    expect(july.map((row) => [day(row.data), row.valorTotal, row.ordemPagamentoAgrupadoIds])).toEqual([
      ['2026-07-31', 3102.72, null],
      ['2026-07-28', 4972.32, null],
      ['2026-07-24', 3151.68, null],
      ['2026-07-21', 4602.24, null],
      ['2026-07-17', 3904.8, null],
      ['2026-07-14', 4845.6, null],
      ['2026-07-10', 2982.72, null],
    ]);
    expect(august.map((row) => [day(row.data), row.valorTotal, row.ordemPagamentoAgrupadoIds])).toEqual([['2026-08-04', 5086.56, '499621']]);
    expect(july.reduce((sum, row) => sum + row.valorTotal!, 0)).toBeCloseTo(27562.08, 2);
    for (const row of [...july, ...august]) {
      expect(row.statusRemessa).toBe(5);
      expect(row.motivoStatusRemessa).toBe('00');
      expect(day(row.dataPagamento)).toBe('2026-09-03');
    }
  });

  it.each([0, 1, 2, 3, 4, 5])('preserves latest status %s without multiplying equal orders or bank details', async (status) => {
    await runner.query(`
      INSERT INTO ordem_pagamento_agrupado VALUES (10, 999, '2026-07-10');
      INSERT INTO ordem_pagamento_agrupado_historico VALUES (1, 10, 0, NULL);
    `);
    await runner.query("INSERT INTO ordem_pagamento_agrupado_historico VALUES (2, 10, $1, '00')", [status]);
    await runner.query(`
      INSERT INTO detalhe_a VALUES (1, 2, 999), (2, 2, 999);
      INSERT INTO ordem_pagamento VALUES
        (1, 2369, '2026-07-04', 10, 10), (2, 2369, '2026-07-05', 10, 10),
        (3, 2369, '2026-07-07', 5, 10), (4, 9999, '2026-07-20', 100, 10);
    `);
    const rows = (await monthly()).filter((row) => row.valorTotal);
    expect(rows.map((row) => [day(row.data), row.valorTotal, row.ordemPagamentoAgrupadoIds, row.statusRemessa])).toEqual([
      ['2026-07-10', 5, '10', status],
      ['2026-07-07', 20, null, status],
    ]);
    expect(rows.every((row) => row.motivoStatusRemessa === '00')).toBe(true);
  });

  it('sums ungrouped and equal-valued orders and rounds only the displayed total', async () => {
    await runner.query(`
      INSERT INTO ordem_pagamento_agrupado VALUES (10, 1, '2026-07-10'), (11, 1, '2026-07-10');
      INSERT INTO ordem_pagamento_agrupado_historico VALUES (1, 10, 1, NULL), (2, 11, 1, NULL);
      INSERT INTO ordem_pagamento VALUES
        (1, 2369, '2026-07-07', 0.004, 10), (2, 2369, '2026-07-07', 0.004, 11),
        (3, 2369, '2026-07-04', 10, NULL), (4, 2369, '2026-07-05', 10, NULL),
        (5, 2369, NULL, 999, 10);
    `);
    const rows = await monthly();
    expect(rows.find((row) => day(row.data) === '2026-07-10')?.valorTotal).toBe(0.01);
    expect(
      String(rows.find((row) => day(row.data) === '2026-07-10')?.ordemPagamentoAgrupadoIds)
        .split(', ')
        .sort(),
    ).toEqual(['10', '11']);
    expect(rows.find((row) => day(row.data) === '2026-07-07')).toMatchObject({
      valorTotal: 20,
      ordemPagamentoAgrupadoIds: null,
    });
    expect(rows.find((row) => day(row.data) === '2026-07-03')).toMatchObject({
      valorTotal: 0,
      ordemPagamentoAgrupadoIds: null,
      dataPagamento: null,
    });
  });

  it('preserves the historical Friday-only calendar and the September transition', async () => {
    await runner.query(`INSERT INTO ordem_pagamento VALUES
      (1, 2369, '2025-08-26 00:00', 1, NULL),
      (2, 2369, '2025-08-28 23:59:59', 2, NULL),
      (3, 2369, '2025-08-25', 99, NULL),
      (4, 2369, '2025-08-29', 4, NULL),
      (5, 2369, '2025-09-01', 5, NULL)`);
    const august = await monthly('2025-08-01');
    expect(august.map((row) => day(row.data))).toEqual(['2025-08-29', '2025-08-22', '2025-08-15', '2025-08-08', '2025-08-01']);
    expect(august.filter((row) => row.valorTotal).map((row) => row.valorTotal)).toEqual([3]);
    const september = await monthly('2025-09-01');
    expect(september.find((row) => day(row.data) === '2025-09-02')?.valorTotal).toBe(9);
  });
});
