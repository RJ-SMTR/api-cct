/**
 * Visao combinada (todosVanzeiros + todosConsorcios): paridade com o findConsolidado legado.
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
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { BasePagamentoRepository } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { RelatorioNovoRemessaConsolidadoRepository } from '../novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { ConsolidadoCombinadoService } from './consolidado-combinado.service';
import { ConsorcioAggregatorService } from './consorcio-aggregator.service';
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

jest.setTimeout(60000);

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 986300000;
const INDIVIDUAL = { id: BASE_ID + 1, nome: 'COMBINADO INDIVIDUAL MODAL', cpf: '98630000001' };
const EMPRESA_STPC = { id: BASE_ID + 2, nome: 'COMBINADO EMPRESA STPC', cpf: '98630000000102' };
const EMPRESA_INTERSUL = { id: BASE_ID + 3, nome: 'COMBINADO EMPRESA INTERSUL', cpf: '98630000000103' };
const USUARIOS = [INDIVIDUAL, EMPRESA_STPC, EMPRESA_INTERSUL];

const PERIODO = { dataInicio: new Date('2091-05-01T00:00:00.000Z'), dataFim: new Date('2091-05-31T00:00:00.000Z') };
const DIA = '2091-05-10';

type Usuario = (typeof USUARIOS)[number];

suite('ConsolidadoCombinadoService (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let service: ConsolidadoCombinadoService;
  let legacy: RelatorioNovoRemessaConsolidadoRepository;

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
    const base = new BasePagamentoRepository(dataSource);
    service = new ConsolidadoCombinadoService(new ConsorcioAggregatorService(base), new VanzeiroAggregatorService(base));
    legacy = new RelatorioNovoRemessaConsolidadoRepository(dataSource);
  }, 60000);

  beforeEach(async () => {
    await cleanFixtures();
    for (const usuario of USUARIOS) {
      await seedUsuario(usuario);
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanFixtures();
    }
    await moduleRef?.close();
  });

  async function cleanFixtures(): Promise<void> {
    const range = [BASE_ID, BASE_ID + 999];
    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, range);
  }

  async function seedUsuario(usuario: Usuario): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (id, email, provider, "fullName", "roleId", "cpfCnpj", "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado, "createdAt", "updatedAt")
       VALUES ($1, $2, 'email', $3, 1, $4, 104, '0001', '99990002', '1', false, now(), now())`,
      [usuario.id, `combinado-${usuario.id}@example.test`, usuario.nome, usuario.cpf],
    );
  }

  async function seedOrdem(id: number, usuario: Usuario, nomeConsorcio: string, valor: number, opaId: number | null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "operadoraCpfCnpj", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $2::date, $3, now(), $4, $5, $6, $7, now(), now())`,
      [id, DIA, valor, usuario.id, nomeConsorcio, usuario.cpf, opaId],
    );
  }

  async function seedLotePago(offset: number, usuario: Usuario, nomeConsorcio: string, valor: number): Promise<void> {
    const opaId = BASE_ID + offset;
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt") VALUES ($1, $2::date, $3, now(), now())`,
      [opaId, DIA, valor],
    );
    await seedOrdem(opaId + 1, usuario, nomeConsorcio, valor, opaId);
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', 3, '00')`,
      [opaId + 2, opaId, DIA],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4::date, $5, $5, $3, now(), now())`,
      [opaId + 3, opaId + 2, offset + 986300, DIA, valor],
    );
  }

  async function seedCenario(): Promise<void> {
    await seedLotePago(100, INDIVIDUAL, 'STPC', 100);
    await seedLotePago(110, EMPRESA_STPC, 'STPC', 9000);
    await seedLotePago(120, EMPRESA_INTERSUL, 'Intersul', 5000);
  }

  const totais = (result: { data: { nomefavorecido: string; valor: number }[] }) =>
    Object.fromEntries(result.data.map((row) => [row.nomefavorecido, Number(row.valor)]));

  const NOVO_PAGO = { ...PERIODO, statuses: [StatusPagamento.PAGO] };
  const LEGADO_PAGO = { ...PERIODO, pago: true, todosVanzeiros: true, todosConsorcios: true };

  async function expectParidade(valores: { valorMin?: number; valorMax?: number }, dataEsperada: Record<string, number>, valorEsperado: number): Promise<void> {
    const [novo, antigo] = await Promise.all([service.aggregate({ ...NOVO_PAGO, ...valores }), legacy.findConsolidado({ ...LEGADO_PAGO, ...valores })]);

    expect(totais(novo)).toEqual(dataEsperada);
    expect(totais(antigo)).toEqual(dataEsperada);
    expect(novo.valor).toBe(valorEsperado);
    expect(antigo.valor).toBe(valorEsperado);
    expect(novo.count).toBe(antigo.count);
  }

  it('keeps the individual modal payee in data without double counting it in valor', async () => {
    await seedCenario();

    await expectParidade({}, { STPC: 9100, Intersul: 5000, [INDIVIDUAL.nome]: 100 }, 14100);
  });

  it('valorMax that drops STPC still discounts the individual while another consorcio is present', async () => {
    await seedCenario();

    await expectParidade({ valorMax: 6000 }, { Intersul: 5000, [INDIVIDUAL.nome]: 100 }, 5000);
  });

  it('valorMax that drops every consorcio counts the individual (2026-11-06)', async () => {
    await seedCenario();

    await expectParidade({ valorMax: 1000 }, { [INDIVIDUAL.nome]: 100 }, 100);
  });

  it('valorMin applies per returned group and drops the individual', async () => {
    await seedCenario();

    await expectParidade({ valorMin: 200 }, { STPC: 9100, Intersul: 5000 }, 14100);
  });

  it('returns an empty result when no group is inside the value filter', async () => {
    await seedCenario();

    await expectParidade({ valorMin: 999999 }, {}, 0);
  });

  it('does not double count valorAPagar and matches legacy data for A Pagar', async () => {
    await seedOrdem(BASE_ID + 200, INDIVIDUAL, 'STPC', 70, null);
    await seedOrdem(BASE_ID + 201, EMPRESA_INTERSUL, 'Intersul', 30, null);

    const filtro = { ...PERIODO, statuses: [StatusPagamento.A_PAGAR] };
    const [novo, antigo] = await Promise.all([service.aggregate(filtro), legacy.findConsolidado({ ...PERIODO, aPagar: true, todosVanzeiros: true, todosConsorcios: true })]);

    expect(totais(novo)).toEqual({ STPC: 70, Intersul: 30, [INDIVIDUAL.nome]: 70 });
    expect(totais(antigo)).toEqual(totais(novo));
    expect(novo.valor).toBe(100);
    expect(antigo.valor).toBe(100);
    expect(novo.valorAPagar).toBe(100);
  });
});
