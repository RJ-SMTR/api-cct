/**
 * Report query timeout (ADR 0023, T1) against a disposable PostgreSQL database.
 * Run with RUN_RETORNO_DB_TESTS=1 only against an isolated local test database.
 */
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import appConfig from 'src/config/app.config';
import databaseConfig from 'src/config/database.config';
import { TypeOrmConfigService } from 'src/database/typeorm-config.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioTimeoutError } from '../../utils/relatorio-timeout.error';
import { BasePagamentoRepository } from './base-pagamento.repository';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

suite('BasePagamentoRepository report query timeout (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    jest.spyOn(CustomLogger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(CustomLogger.prototype, 'error').mockImplementation(() => undefined);

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, appConfig], envFilePath: ['.env'] }),
        TypeOrmModule.forRootAsync({
          useClass: TypeOrmConfigService,
          dataSourceFactory: async (options: DataSourceOptions) => new DataSource(options).initialize(),
        }),
      ],
    }).compile();

    dataSource = moduleRef.get(getDataSourceToken());
  }, 60000);

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('throws RelatorioTimeoutError when the query exceeds the limit', async () => {
    const repository = new BasePagamentoRepository(dataSource, { statementTimeoutMs: 500 });

    await expect(repository.runReportQuery('SELECT pg_sleep(2)', [])).rejects.toBeInstanceOf(RelatorioTimeoutError);
  });

  it('does not leak the limit to later queries on the pool', async () => {
    const repository = new BasePagamentoRepository(dataSource, { statementTimeoutMs: 500 });
    await repository.runReportQuery('SELECT pg_sleep(2)', []).catch(() => undefined);

    // Several plain queries, so at least one reuses the connection the report query used.
    const results = await Promise.all(Array.from({ length: 5 }, () => dataSource.query('SHOW statement_timeout')));

    for (const [row] of results) {
      expect(row.statement_timeout).not.toBe('500ms');
    }
  });

  it('returns the rows of a query within the limit', async () => {
    const repository = new BasePagamentoRepository(dataSource, { statementTimeoutMs: 500 });

    await expect(repository.runReportQuery('SELECT $1::int AS valor', [7])).resolves.toEqual([{ valor: 7 }]);
  });

  it('uses 120 s by default', async () => {
    const repository = new BasePagamentoRepository(dataSource);

    await expect(repository.runReportQuery('SHOW statement_timeout', [])).resolves.toEqual([{ statement_timeout: '2min' }]);
  });

  it('rethrows errors that are not timeouts unchanged', async () => {
    const repository = new BasePagamentoRepository(dataSource, { statementTimeoutMs: 500 });

    const error = await repository.runReportQuery('SELECT 1/0', []).catch((e) => e);

    expect(error).not.toBeInstanceOf(RelatorioTimeoutError);
    expect(error.code).toBe('22012');
  });
});
