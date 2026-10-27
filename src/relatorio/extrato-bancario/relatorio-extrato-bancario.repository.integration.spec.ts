/**
 * Characterization coverage against a disposable PostgreSQL database, written before
 * parametrizing `RelatorioExtratoBancarioRepository` (T1, docs/tasks/T1.md).
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
import { RelatorioExtratoBancarioRepository } from './relatorio-extrato-bancario.repository';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 993000000;
const ARQUIVO_ID = BASE_ID + 1;
const LOTE_ID = BASE_ID + 2;
const DEBITO_DETALHE_ID = BASE_ID + 10;
const CREDITO_DETALHE_ID = BASE_ID + 11;
const CETT_DETALHE_ID = BASE_ID + 12;
const OUTRA_CONTA_DETALHE_ID = BASE_ID + 13;
const ASPA_DETALHE_ID = BASE_ID + 14;

suite('RelatorioExtratoBancarioRepository (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: RelatorioExtratoBancarioRepository;

  beforeAll(async () => {
    jest.spyOn(CustomLogger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(CustomLogger.prototype, 'error').mockImplementation(() => undefined);

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, appConfig],
          envFilePath: ['.env'],
        }),
        TypeOrmModule.forRootAsync({
          useClass: TypeOrmConfigService,
          dataSourceFactory: async (options: DataSourceOptions) => new DataSource(options).initialize(),
        }),
      ],
    }).compile();

    dataSource = moduleRef.get(getDataSourceToken());
    repository = new RelatorioExtratoBancarioRepository(dataSource);
  }, 60000);

  beforeEach(async () => {
    await cleanFixtures();
    await seedFixtures();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanFixtures();
    }
    await moduleRef?.close();
  });

  async function cleanFixtures(): Promise<void> {
    if (!dataSource?.isInitialized) {
      return;
    }
    await dataSource.query(`DELETE FROM extrato_detalhe_e WHERE id BETWEEN $1 AND $2`, [BASE_ID + 10, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM extrato_header_lote WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 9]);
    await dataSource.query(`DELETE FROM extrato_header_arquivo WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 9]);
  }

  async function seedFixtures(): Promise<void> {
    await dataSource.query(
      `INSERT INTO extrato_header_arquivo (id, nsa, "retornoName", "createdAt")
       VALUES ($1, 1, 'RETORNO_TESTE_T1', now())`,
      [ARQUIVO_ID],
    );
    await dataSource.query(
      `INSERT INTO extrato_header_lote (
        id, "extratoHeaderArquivoId", "dataSaldoInicial", "valorSaldoInicial",
        "situacaoSaldoInicial", "posicaoSaldoInicial", "tipoMoeda", "createdAt"
      ) VALUES ($1, $2, DATE '2099-01-01', 1000, '0', 'C', 'BRL', now())`,
      [LOTE_ID, ARQUIVO_ID],
    );
    await dataSource.query(
      `INSERT INTO extrato_detalhe_e (
        id, "extratoHeaderLoteId", "loteServico", nsr, "tipoInscricao", "numeroInscricao",
        "codigoConvenioBanco", agencia, "dvAgencia", conta, "dvConta", "dvAgenciaConta",
        "nomeEmpresa", "dataLancamento", "valorLancamento", "tipoLancamento",
        "categoriaLancamento", "codigoHistoricoBanco", "descricaoHistoricoBanco",
        "numeroDocumento", "createdAt"
      ) VALUES
        ($1, $6, 1, 1, '2', '12345678901234', '000001', '0001', '0', '0000001', '1', '0',
         'EMPRESA TESTE', TIMESTAMP '2099-01-10 10:00:00', 100.00, 'D', '01', '001', 'Pagamento Debito', 'DOC-1', now()),
        ($2, $6, 1, 2, '2', '12345678901234', '000001', '0001', '0', '0000001', '1', '0',
         'EMPRESA TESTE', TIMESTAMP '2099-01-10 11:00:00', 200.00, 'C', '01', '002', 'Recebimento Credito', 'DOC-2', now()),
        ($3, $6, 1, 3, '2', '12345678901234', '000001', '0001', '0', '0000001', '1', '0',
         'EMPRESA TESTE', TIMESTAMP '2099-01-10 12:00:00', 300.00, 'D', '02', '003', 'Lote Cett', 'DOC-3', now()),
        ($4, $6, 2, 4, '2', '12345678901234', '000001', '0001', '0', '0000001', '1', '0',
         'EMPRESA TESTE', TIMESTAMP '2099-01-10 13:00:00', 400.00, 'D', '02', '004', 'Lote Outro', 'DOC-4', now()),
        ($5, $6, 1, 5, '2', '12345678901234', '000001', '0001', '0', '0000001', '1', '0',
         'EMPRESA TESTE', TIMESTAMP '2099-01-10 14:00:00', 500.00, 'D', '03', '005', 'Transferencia O''Brien', 'DOC-5', now())`,
      [DEBITO_DETALHE_ID, CREDITO_DETALHE_ID, CETT_DETALHE_ID, OUTRA_CONTA_DETALHE_ID, ASPA_DETALHE_ID, LOTE_ID],
    );

    await dataSource.query(
      `UPDATE extrato_detalhe_e SET "loteServico" = 2 WHERE id = $1`,
      [OUTRA_CONTA_DETALHE_ID],
    );
  }

  function baseArgs() {
    return {
      dataInicio: new Date('2099-01-01'),
      dataFim: new Date('2099-01-31'),
      tipo: undefined as string | undefined,
      operacao: undefined as string[] | undefined,
      conta: undefined as string | undefined,
    };
  }

  it('retorna todas as linhas no intervalo sem filtro opcional', async () => {
    const result = await repository.findExtrato(baseArgs());

    const ids = result.map((r: any) => r.id).sort((a: number, b: number) => a - b);
    expect(ids).toEqual([DEBITO_DETALHE_ID, CREDITO_DETALHE_ID, CETT_DETALHE_ID, OUTRA_CONTA_DETALHE_ID, ASPA_DETALHE_ID].sort((a, b) => a - b));
  });

  it('filtra por tipo', async () => {
    const result = await repository.findExtrato({ ...baseArgs(), tipo: 'C' });

    expect(result.map((r: any) => r.id)).toEqual([CREDITO_DETALHE_ID]);
  });

  it('filtra por operacao (array)', async () => {
    const result = await repository.findExtrato({ ...baseArgs(), operacao: ['Pagamento Debito', 'Recebimento Credito'] });

    const ids = result.map((r: any) => r.id).sort((a: number, b: number) => a - b);
    expect(ids).toEqual([DEBITO_DETALHE_ID, CREDITO_DETALHE_ID].sort((a, b) => a - b));
  });

  it('filtra por conta cett (loteServico=1) e por outra conta (loteServico=2)', async () => {
    const cett = await repository.findExtrato({ ...baseArgs(), conta: 'cett' });
    const outra = await repository.findExtrato({ ...baseArgs(), conta: 'outra' });

    const cettIds = cett.map((r: any) => r.id).sort((a: number, b: number) => a - b);
    expect(cettIds).toEqual([DEBITO_DETALHE_ID, CREDITO_DETALHE_ID, CETT_DETALHE_ID, ASPA_DETALHE_ID].sort((a, b) => a - b));
    expect(outra.map((r: any) => r.id)).toEqual([OUTRA_CONTA_DETALHE_ID]);
  });

  it('não quebra e não deixa a aspa simples de operacao agir como parte da query', async () => {
    const result = await repository.findExtrato({ ...baseArgs(), operacao: ["Transferencia O'Brien"] });

    expect(result.map((r: any) => r.id)).toEqual([ASPA_DETALHE_ID]);
  });
});
