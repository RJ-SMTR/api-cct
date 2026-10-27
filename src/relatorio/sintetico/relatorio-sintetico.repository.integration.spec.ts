/**
 * Characterization coverage against a disposable PostgreSQL database, written before
 * parametrizing `RelatorioSinteticoRepository` (T3, docs/tasks/T3.md).
 * Run with RUN_RETORNO_DB_TESTS=1 only against an isolated local test database.
 *
 * getQueryNaoApagar (aPagar=false/undefined) inner-joins "transacao_agrupado", a table
 * that does not exist in this local database (pre-existing gap, confirmed independently
 * of this refactor). Per docs/task-runs/T3-CONTEXT.md, that path is only checked for
 * "still fails the same way" (same missing-relation error) before and after the
 * parametrization, not for full behavioral equivalence.
 */
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import appConfig from 'src/config/app.config';
import databaseConfig from 'src/config/database.config';
import { TypeOrmConfigService } from 'src/database/typeorm-config.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioSinteticoRepository } from './relatorio-sintetico.repository';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 991000000;

suite('RelatorioSinteticoRepository (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: RelatorioSinteticoRepository;

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
    repository = new RelatorioSinteticoRepository(dataSource);
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
    await dataSource.query(`DELETE FROM transacao_view WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM cliente_favorecido WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 99]);
  }

  async function seedClienteFavorecido(id: number, nome: string, cpfCnpj: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO cliente_favorecido (id, nome, "cpfCnpj") VALUES ($1, $2, $3)`,
      [id, nome, cpfCnpj],
    );
  }

  async function seedUser(id: number, fullName: string, cpfCnpj: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "permitCode", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', $3, 6, $4, $5,
        104, '0001', '99990001', '1', false, now(), now()
      )`,
      [id, `sintetico-${id}@example.test`, fullName, `TEST-${id}`, cpfCnpj],
    );
  }

  async function seedTransacaoViewApagar(id: number, nomeConsorcio: string, operadoraCpfCnpj: string, valorPago: number, datetimeTransacao: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO transacao_view (
        id, "datetimeTransacao", "datetimeProcessamento", "datetimeCaptura", modo,
        "nomeConsorcio", "nomeOperadora", "idTransacao", "tipoPagamento",
        "valorTransacao", "valorPago", "operadoraCpfCnpj", "itemTransacaoAgrupadoId",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2::timestamp, $2::timestamp, $2::timestamp, 'debito',
        $3, 'OPERADORA TESTE', $6, 'avista',
        $4, $4, $5, NULL,
        now(), now()
      )`,
      [id, datetimeTransacao, nomeConsorcio, valorPago, operadoraCpfCnpj, String(id)],
    );
  }

  function baseArgs() {
    return {
      dataInicio: new Date('2099-01-01'),
      dataFim: new Date('2099-01-31'),
      favorecidoNome: undefined as string[] | undefined,
      consorcioNome: undefined as string[] | undefined,
      valorMin: undefined as number | undefined,
      valorMax: undefined as number | undefined,
      pago: undefined as boolean | undefined,
      aPagar: true as boolean | undefined,
      emProcessamento: undefined as boolean | undefined,
    };
  }

  it('aPagar=true usa getQueryApagar e resolve favorecido via cliente_favorecido', async () => {
    const ID = BASE_ID + 10;
    await seedClienteFavorecido(ID + 1, 'Favorecido A', String(ID + 1));
    await seedTransacaoViewApagar(ID, 'VLT', String(ID + 1), 150, '2099-01-10 10:00:00');

    const result: any[] = await repository.findSintetico({ ...baseArgs(), aPagar: true });

    expect(result).toEqual([expect.objectContaining({ consorcio: 'VLT', favorecido: 'Favorecido A', valor: 150 })]);
  });

  it('aPagar=true cai para public.user quando nao ha cliente_favorecido correspondente', async () => {
    const ID = BASE_ID + 20;
    await seedUser(ID + 1, 'Usuario B', String(ID + 1));
    await seedTransacaoViewApagar(ID, 'Santa Cruz', String(ID + 1), 250, '2099-01-11 10:00:00');

    const result: any[] = await repository.findSintetico({ ...baseArgs(), aPagar: true });

    expect(result).toEqual([expect.objectContaining({ consorcio: 'Santa Cruz', favorecido: 'Usuario B', valor: 250 })]);
  });

  it("consorcioNome=['Todos'] sozinho nao filtra por consorcio (comportamento atual preservado)", async () => {
    const ID_A = BASE_ID + 30;
    await seedClienteFavorecido(ID_A + 1, 'Favorecido C', String(ID_A + 1));
    await seedTransacaoViewApagar(ID_A, 'VLT', String(ID_A + 1), 100, '2099-01-12 10:00:00');

    const ID_B = BASE_ID + 40;
    await seedClienteFavorecido(ID_B + 1, 'Favorecido D', String(ID_B + 1));
    await seedTransacaoViewApagar(ID_B, 'Internorte', String(ID_B + 1), 200, '2099-01-13 10:00:00');

    const result: any[] = await repository.findSintetico({ ...baseArgs(), aPagar: true, consorcioNome: ['Todos'] });

    const consorcios = result.map((r) => r.consorcio).sort();
    expect(consorcios).toEqual(['Internorte', 'VLT']);
  });

  it('favorecidoNome com aspa simples nao quebra a query', async () => {
    const ID = BASE_ID + 50;
    await seedClienteFavorecido(ID + 1, "Favorecido O'Brien", String(ID + 1));
    await seedTransacaoViewApagar(ID, 'TEC', String(ID + 1), 300, '2099-01-14 10:00:00');

    const result: any[] = await repository.findSintetico({
      ...baseArgs(),
      aPagar: true,
      favorecidoNome: ["Favorecido O'Brien"],
    });

    expect(result).toEqual([expect.objectContaining({ consorcio: 'TEC', favorecido: "Favorecido O'Brien", valor: 300 })]);
  });

  it.each([
    ['aPagar=false (getQueryNaoApagar)', { aPagar: false as boolean | undefined }],
    ['aPagar=undefined (UNION ALL getQueryApagar+getQueryNaoApagar)', { aPagar: undefined as boolean | undefined }],
  ])('%s falha hoje por falta da tabela transacao_agrupado (pre-existente, nao corrigido por este refactor)', async (_label, overrides) => {
    await expect(repository.findSintetico({ ...baseArgs(), ...overrides })).rejects.toThrow(/transacao_agrupado/);
  });
});
