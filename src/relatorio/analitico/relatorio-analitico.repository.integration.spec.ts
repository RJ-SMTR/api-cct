/**
 * Characterization coverage against a disposable PostgreSQL database, written before
 * parametrizing `RelatorioAnaliticoRepository` (T2, docs/tasks/T2.md).
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
import { RelatorioAnaliticoRepository } from './relatorio-analitico.repository';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 992000000;

suite('RelatorioAnaliticoRepository (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: RelatorioAnaliticoRepository;

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
    repository = new RelatorioAnaliticoRepository(dataSource);
  }, 60000);

  afterEach(async () => {
    await cleanFixtures();
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
    await dataSource.query(`DELETE FROM transacao_view WHERE id BETWEEN $1 AND $2`, [BASE_ID + 40, BASE_ID + 49]);
    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [BASE_ID + 10, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM arquivo_publicacao WHERE id BETWEEN $1 AND $2`, [BASE_ID + 10, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM item_transacao WHERE id BETWEEN $1 AND $2`, [BASE_ID + 10, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM item_transacao_agrupado WHERE id BETWEEN $1 AND $2`, [BASE_ID + 10, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM cliente_favorecido WHERE id BETWEEN $1 AND $2`, [BASE_ID + 10, BASE_ID + 99]);
  }

  async function seedClienteFavorecido(id: number, nome: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO cliente_favorecido (id, nome, "cpfCnpj") VALUES ($1, $2, $3)`,
      [id, nome, String(id)],
    );
  }

  async function seedItemTransacaoAgrupado(id: number, nomeConsorcio: string, dataOrdem: string, valor: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO item_transacao_agrupado (id, "nomeConsorcio", valor, "dataOrdem", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::date, now(), now())`,
      [id, nomeConsorcio, valor, dataOrdem],
    );
  }

  async function seedItemTransacao(id: number, itemTransacaoAgrupadoId: number, clienteFavorecidoId: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO item_transacao (id, "itemTransacaoAgrupadoId", "clienteFavorecidoId", "dataOrdem", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, now(), now(), now())`,
      [id, itemTransacaoAgrupadoId, clienteFavorecidoId],
    );
  }

  async function seedArquivoPublicacao(id: number, itemTransacaoId: number, isPago: boolean): Promise<void> {
    await dataSource.query(
      `INSERT INTO arquivo_publicacao (id, "itemTransacaoId", "isPago", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, now(), now())`,
      [id, itemTransacaoId, isPago],
    );
  }

  async function seedDetalheA(id: number, itemTransacaoAgrupadoId: number, dataVencimento: string, valorLancamento: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "itemTransacaoAgrupadoId", "dataVencimento", "valorLancamento", nsr, "numeroDocumentoEmpresa", "createdAt", "updatedAt")
       VALUES ($1, $2, $3::date, $4, $1, $1, now(), now())`,
      [id, itemTransacaoAgrupadoId, dataVencimento, valorLancamento],
    );
  }

  async function seedTransacaoView(id: number, itemTransacaoAgrupadoId: number, nomeConsorcio: string, operadoraCpfCnpj: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO transacao_view (
        id, "datetimeTransacao", "datetimeProcessamento", "datetimeCaptura", modo,
        "nomeConsorcio", "nomeOperadora", "idTransacao", "tipoPagamento",
        "valorTransacao", "itemTransacaoAgrupadoId", "operadoraCpfCnpj", "createdAt", "updatedAt"
      ) VALUES (
        $1, now(), now(), now(), 'debito',
        $2, 'OPERADORA TESTE', $5, 'avista',
        1, $3, $4, now(), now()
      )`,
      [id, nomeConsorcio, itemTransacaoAgrupadoId, operadoraCpfCnpj, String(id)],
    );
  }

  function baseArgs() {
    return {
      dataInicio: new Date('2099-01-01'),
      dataFim: new Date('2099-01-31'),
      userIds: undefined,
      favorecidoNome: undefined as string[] | undefined,
      consorcioNome: undefined as string[] | undefined,
      valorMin: undefined as number | undefined,
      valorMax: undefined as number | undefined,
      pago: undefined as boolean | undefined,
      aPagar: undefined as boolean | undefined,
    };
  }

  it('aPagar=true sem favorecidoNome/consorcioNome usa getQueryAPagarConsorcio (agrupado por consorcio)', async () => {
    const ID = BASE_ID + 10;
    await seedClienteFavorecido(ID + 3, 'Favorecido A');
    await seedItemTransacaoAgrupado(ID, 'VLT', '2099-01-10', 100);
    await seedItemTransacao(ID + 1, ID, ID + 3);
    await seedArquivoPublicacao(ID + 2, ID + 1, false);

    const result: any[] = await repository.findAnalitico({ ...baseArgs(), aPagar: true });

    expect(result).toEqual([expect.objectContaining({ nomefavorecido: 'VLT', valor: 100 })]);
  });

  it('aPagar=false com consorcioNome definido usa getQueryConsorcio (agrupado por consorcio, via detalhe_a)', async () => {
    const ID = BASE_ID + 20;
    await seedClienteFavorecido(ID + 4, 'Favorecido B');
    await seedItemTransacaoAgrupado(ID, 'Santa Cruz', '2098-01-01', 999);
    await seedDetalheA(ID + 1, ID, '2099-01-15', 200);
    await seedItemTransacao(ID + 2, ID, ID + 4);
    await seedArquivoPublicacao(ID + 3, ID + 2, true);

    const result: any[] = await repository.findAnalitico({
      ...baseArgs(),
      aPagar: false,
      consorcioNome: ['Santa Cruz'],
      pago: true,
    });

    expect(result).toEqual([expect.objectContaining({ nomefavorecido: 'Santa Cruz', valor: 200 })]);
  });

  it('aPagar=true com favorecidoNome definido (sem consorcioNome) usa getQueryAPagarOperadores (agrupado por favorecido)', async () => {
    const ID = BASE_ID + 30;
    await seedClienteFavorecido(ID + 3, 'Favorecido C');
    await seedItemTransacaoAgrupado(ID, 'STPC', '2099-01-12', 300);
    await seedItemTransacao(ID + 1, ID, ID + 3);
    await seedArquivoPublicacao(ID + 2, ID + 1, false);

    const result: any[] = await repository.findAnalitico({
      ...baseArgs(),
      aPagar: true,
      favorecidoNome: ['Favorecido C'],
    });

    expect(result).toEqual([expect.objectContaining({ nomefavorecido: 'Favorecido C', valor: 300 })]);
  });

  it('aPagar=false com favorecidoNome definido usa getQueryOperadores (via transacao_view)', async () => {
    const ID = BASE_ID + 40;
    await seedClienteFavorecido(ID + 5, 'Favorecido D');
    await seedItemTransacaoAgrupado(ID + 1, 'STPC', '2098-01-01', 999);
    await seedTransacaoView(ID, ID + 1, 'STPC', String(ID + 5));
    await seedDetalheA(ID + 2, ID + 1, '2099-01-18', 400);
    await seedItemTransacao(ID + 3, ID + 1, ID + 5);
    await seedArquivoPublicacao(ID + 4, ID + 3, true);

    const result: any[] = await repository.findAnalitico({
      ...baseArgs(),
      aPagar: false,
      favorecidoNome: ['Favorecido D'],
      pago: true,
    });

    expect(result).toEqual([expect.objectContaining({ nomefavorecido: 'Favorecido D', valor: 400 })]);
  });

  it('consorcioNome e favorecidoNome definidos juntos combinam getQueryConsorcio e getQueryOperadores via UNION ALL', async () => {
    const CONSORCIO_ID = BASE_ID + 20;
    await seedClienteFavorecido(CONSORCIO_ID + 4, 'Favorecido B');
    await seedItemTransacaoAgrupado(CONSORCIO_ID, 'Santa Cruz', '2098-01-01', 999);
    await seedDetalheA(CONSORCIO_ID + 1, CONSORCIO_ID, '2099-01-15', 200);
    await seedItemTransacao(CONSORCIO_ID + 2, CONSORCIO_ID, CONSORCIO_ID + 4);
    await seedArquivoPublicacao(CONSORCIO_ID + 3, CONSORCIO_ID + 2, true);

    const OPERADOR_ID = BASE_ID + 40;
    await seedClienteFavorecido(OPERADOR_ID + 5, 'Favorecido D');
    await seedItemTransacaoAgrupado(OPERADOR_ID + 1, 'STPC', '2098-01-01', 999);
    await seedTransacaoView(OPERADOR_ID, OPERADOR_ID + 1, 'STPC', String(OPERADOR_ID + 5));
    await seedDetalheA(OPERADOR_ID + 2, OPERADOR_ID + 1, '2099-01-18', 400);
    await seedItemTransacao(OPERADOR_ID + 3, OPERADOR_ID + 1, OPERADOR_ID + 5);
    await seedArquivoPublicacao(OPERADOR_ID + 4, OPERADOR_ID + 3, true);

    const result: any[] = await repository.findAnalitico({
      ...baseArgs(),
      aPagar: false,
      consorcioNome: ['Santa Cruz'],
      favorecidoNome: ['Favorecido D'],
      pago: true,
    });

    const sorted = [...result].sort((a, b) => a.nomefavorecido.localeCompare(b.nomefavorecido));
    expect(sorted).toEqual([
      expect.objectContaining({ nomefavorecido: 'Favorecido D', valor: 400 }),
      expect.objectContaining({ nomefavorecido: 'Santa Cruz', valor: 200 }),
    ]);
  });

  it('valorMin filtra o resultado agregado por consorcio (getQueryAPagarConsorcio)', async () => {
    const LOW_ID = BASE_ID + 50;
    await seedClienteFavorecido(LOW_ID + 3, 'Favorecido E');
    await seedItemTransacaoAgrupado(LOW_ID, 'VLT', '2099-01-10', 50);
    await seedItemTransacao(LOW_ID + 1, LOW_ID, LOW_ID + 3);
    await seedArquivoPublicacao(LOW_ID + 2, LOW_ID + 1, false);

    const HIGH_ID = BASE_ID + 60;
    await seedClienteFavorecido(HIGH_ID + 3, 'Favorecido F');
    await seedItemTransacaoAgrupado(HIGH_ID, 'Internorte', '2099-01-11', 500);
    await seedItemTransacao(HIGH_ID + 1, HIGH_ID, HIGH_ID + 3);
    await seedArquivoPublicacao(HIGH_ID + 2, HIGH_ID + 1, false);

    const result: any[] = await repository.findAnalitico({ ...baseArgs(), aPagar: true, valorMin: 100 });

    expect(result).toEqual([expect.objectContaining({ nomefavorecido: 'Internorte', valor: 500 })]);
  });

  it('favorecidoNome com aspa simples nao quebra a query (getQueryAPagarOperadores)', async () => {
    const ID = BASE_ID + 70;
    await seedClienteFavorecido(ID + 3, "Favorecido O'Brien");
    await seedItemTransacaoAgrupado(ID, 'STPL', '2099-01-13', 700);
    await seedItemTransacao(ID + 1, ID, ID + 3);
    await seedArquivoPublicacao(ID + 2, ID + 1, false);

    const result: any[] = await repository.findAnalitico({
      ...baseArgs(),
      aPagar: true,
      favorecidoNome: ["Favorecido O'Brien"],
    });

    expect(result).toEqual([expect.objectContaining({ nomefavorecido: "Favorecido O'Brien", valor: 700 })]);
  });
});
