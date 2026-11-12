import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RelatorioTimeoutError } from '../../utils/relatorio-timeout.error';
import { BasePagamentoRepository } from './base-pagamento.repository';

// ADR 0023 (T12): in homolog a 1-year query was cut by the load balancer at ~184 s without the 504, even though
// Postgres honors SET LOCAL statement_timeout. The API now also has its own timer: it answers the timeout, cancels
// the query in Postgres and logs it, whatever kept the database from cancelling first.
describe('BasePagamentoRepository report query app-side timeout', () => {
  function fakeDataSource(options: { hangs: boolean }) {
    let liberarConsulta: (rows: unknown[]) => void = () => undefined;
    const runner = {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('SELECT pg_backend_pid()')) return [{ pid: 4242 }];
        if (sql.startsWith('START') || sql.startsWith('SET LOCAL') || sql === 'COMMIT' || sql === 'ROLLBACK') return [];
        if (!options.hangs) return [{ valor: 1 }];
        return new Promise((resolve) => {
          liberarConsulta = resolve;
        });
      }),
    };
    const dataSource = {
      createQueryRunner: () => runner,
      query: jest.fn().mockResolvedValue([{ pg_cancel_backend: true }]),
    } as unknown as DataSource;
    return { dataSource, runner, liberarConsulta: (rows: unknown[]) => liberarConsulta(rows) };
  }

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers RelatorioTimeoutError when the database does not cancel in time, and cancels the query', async () => {
    const { dataSource } = fakeDataSource({ hangs: true });
    const repository = new BasePagamentoRepository(dataSource, { statementTimeoutMs: 30, appTimeoutGraceMs: 20 });

    const inicio = Date.now();
    await expect(repository.runReportQuery('SELECT pesado', [])).rejects.toBeInstanceOf(RelatorioTimeoutError);

    expect(Date.now() - inicio).toBeLessThan(1000);
    expect(dataSource.query).toHaveBeenCalledWith('SELECT pg_cancel_backend($1)', [4242]);
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  it('releases the connection only after the abandoned query finishes', async () => {
    const { dataSource, runner, liberarConsulta } = fakeDataSource({ hangs: true });
    const repository = new BasePagamentoRepository(dataSource, { statementTimeoutMs: 30, appTimeoutGraceMs: 20 });

    await repository.runReportQuery('SELECT pesado', []).catch(() => undefined);
    expect(runner.release).not.toHaveBeenCalled();

    liberarConsulta([]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('returns the rows and never cancels when the query finishes in time', async () => {
    const { dataSource, runner } = fakeDataSource({ hangs: false });
    const repository = new BasePagamentoRepository(dataSource, { statementTimeoutMs: 1000, appTimeoutGraceMs: 1000 });

    await expect(repository.runReportQuery('SELECT rapido', [])).resolves.toEqual([{ valor: 1 }]);

    expect(dataSource.query).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });
});
