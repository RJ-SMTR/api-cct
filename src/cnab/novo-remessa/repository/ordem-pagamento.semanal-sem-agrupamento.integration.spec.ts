/**
 * Disposable local PostgreSQL, no application bootstrap or production credentials.
 * WEEKLY_NO_GROUPING_TEST_PORT=5432 npx jest ordem-pagamento.semanal-sem-agrupamento.integration --runInBand
 */
import { DataSource, Repository } from 'typeorm';
import { OrdemPagamentoRepository } from './ordem-pagamento.repository';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';

const suite = process.env.WEEKLY_NO_GROUPING_TEST_PORT ? describe : describe.skip;

suite('Weekly capture allocations without a grouped order (PostgreSQL)', () => {
  let ds: DataSource;
  let runner: ReturnType<DataSource['createQueryRunner']>;
  let repository: OrdemPagamentoRepository;

  beforeAll(async () => {
    ds = await new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: Number(process.env.WEEKLY_NO_GROUPING_TEST_PORT),
      username: 'postgres',
      password: process.env.WEEKLY_NO_GROUPING_TEST_PASSWORD ?? 'postgres',
      database: 'postgres',
      entities: [],
      synchronize: false,
    }).initialize();
    runner = ds.createQueryRunner();
    await runner.connect();
    await runner.query(`
      CREATE TEMP TABLE ordem_pagamento (
        id integer PRIMARY KEY, "userId" integer, "dataCaptura" timestamp, "dataOrdem" date,
        valor numeric(13,5), "ordemPagamentoAgrupadoId" integer,
        "valorGratuidade" numeric(13,5), "ordemPagamentoAgrupadoGratuidadeId" integer
      );
    `);
    const orders = new Repository<OrdemPagamento>(OrdemPagamento, runner.manager, runner);
    repository = new OrdemPagamentoRepository(orders, ds);
  });

  afterAll(async () => {
    if (runner) await runner.release();
    if (ds?.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    await runner.query(`TRUNCATE pg_temp.ordem_pagamento`);
  });

  // Sexta-feira: a janela (4 dias) vai de segunda a quinta da mesma semana (subDays=3 a partir da sexta).
  const dataTentativaSexta = new Date('2026-10-23T00:00:00Z');

  it('returns one row per day for orphan captures inside the payment window', async () => {
    await runner.query(`
      INSERT INTO ordem_pagamento (id, "userId", "dataCaptura", "dataOrdem", valor) VALUES
        (1, 3478, '2026-10-20 10:00', '2026-10-20', 1000.00),
        (2, 3478, '2026-10-21 10:00', '2026-10-21', 600.00),
        (3, 3478, '2026-10-21 15:00', '2026-10-21', 640.00);
    `);

    const rows = await repository.findOrdensPagamentoSemanaSemAgrupamento(3478, dataTentativaSexta);

    expect(
      rows
        .map((row) => ({ date: row.dataCaptura?.toISOString().slice(0, 10), value: row.valor }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    ).toEqual([
      { date: '2026-10-20', value: 1000 },
      { date: '2026-10-21', value: 1240 },
    ]);
  });

  it('excludes captures that already belong to a grouped order', async () => {
    await runner.query(`
      INSERT INTO ordem_pagamento (id, "userId", "dataCaptura", "dataOrdem", valor, "ordemPagamentoAgrupadoId") VALUES
        (4, 3478, '2026-10-20 10:00', '2026-10-20', 500.00, 999);
    `);

    const rows = await repository.findOrdensPagamentoSemanaSemAgrupamento(3478, dataTentativaSexta);

    expect(rows).toEqual([]);
  });

  it('excludes captures from a different user', async () => {
    await runner.query(`
      INSERT INTO ordem_pagamento (id, "userId", "dataCaptura", "dataOrdem", valor) VALUES
        (5, 1111, '2026-10-20 10:00', '2026-10-20', 500.00);
    `);

    const rows = await repository.findOrdensPagamentoSemanaSemAgrupamento(3478, dataTentativaSexta);

    expect(rows).toEqual([]);
  });

  it('returns an empty array when there are no orphan captures in the window', async () => {
    const rows = await repository.findOrdensPagamentoSemanaSemAgrupamento(3478, dataTentativaSexta);

    expect(rows).toEqual([]);
  });

  it('includes valorGratuidade summed from captures linked to the gratuidade grouping', async () => {
    await runner.query(`
      INSERT INTO ordem_pagamento (id, "userId", "dataCaptura", "dataOrdem", valor, "valorGratuidade", "ordemPagamentoAgrupadoGratuidadeId") VALUES
        (6, 3478, '2026-10-20 10:00', '2026-10-20', 300.00, 50.00, 777);
    `);

    const rows = await repository.findOrdensPagamentoSemanaSemAgrupamento(3478, dataTentativaSexta);

    expect(rows.map((row) => ({ value: row.valor, gratuidade: row.valorGratuidade }))).toEqual([
      { value: 300, gratuidade: 50 },
    ]);
  });
});
