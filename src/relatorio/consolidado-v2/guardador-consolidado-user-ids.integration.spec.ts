/**
 * Consolidado v2 (perfil Guardador): paridade do filtro userIds contra o legado.
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
import { RelatorioGuardadorConsolidadoRepository } from '../consolidado/relatorio-guardador-consolidado.repository';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { BasePagamentoRepository } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

jest.setTimeout(60000);

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 986400000;
const SELECIONADO = { id: BASE_ID + 1, nome: 'GUARDADOR V2 SELECIONADO', cpf: '98640000001' };
const OUTRO = { id: BASE_ID + 2, nome: 'GUARDADOR V2 OUTRO', cpf: '98640000002' };
const PERIODO = { dataInicio: new Date('2089-03-01T00:00:00.000Z'), dataFim: new Date('2089-03-31T00:00:00.000Z') };
const DIA = '2089-03-10';

suite('Consolidado v2 - Guardador com userIds (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let aggregator: VanzeiroAggregatorService;
  let legacy: RelatorioGuardadorConsolidadoRepository;

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
    aggregator = new VanzeiroAggregatorService(new BasePagamentoRepository(dataSource));
    legacy = new RelatorioGuardadorConsolidadoRepository(dataSource);
  }, 60000);

  beforeEach(async () => {
    await cleanFixtures();
    // O legado exige roleId 6; o banco local nao tem essa role por seed.
    await dataSource.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
    await seedUsuario(SELECIONADO);
    await seedUsuario(OUTRO);
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
    await dataSource.query(`DELETE FROM ordem_pagamento_guardador WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, range);
  }

  async function seedUsuario(usuario: typeof SELECIONADO): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (id, email, provider, "fullName", "roleId", "cpfCnpj", "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado, "createdAt", "updatedAt")
       VALUES ($1, $2, 'email', $3, 6, $4, 104, '0001', '99990002', '1', false, now(), now())`,
      [usuario.id, `guardador-v2-${usuario.id}@example.test`, usuario.nome, usuario.cpf],
    );
  }

  async function seedOrdem(id: number, usuario: typeof SELECIONADO, valor: number, opaId: number | null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_guardador (id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId", "tipoOrdemPagamento", "ordemPagamentoAgrupadoId", "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $2::date, $3, $4, 'AUTOMATICA', $5, 0, 0, 0, now(), now())`,
      [id, DIA, valor, usuario.id, opaId],
    );
  }

  async function seedLotePago(offset: number, usuario: typeof SELECIONADO, valor: number): Promise<void> {
    const opaId = BASE_ID + offset;
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt") VALUES ($1, $2::date, $3, now(), now())`,
      [opaId, DIA, valor],
    );
    await seedOrdem(opaId + 1, usuario, valor, opaId);
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', 3, '00')`,
      [opaId + 2, opaId, DIA],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4::date, $5, $5, $3, now(), now())`,
      [opaId + 3, opaId + 2, offset + 986400, DIA, valor],
    );
  }

  const totais = (result: { data: { nomefavorecido: string; valor: number }[] }) =>
    Object.fromEntries(result.data.map((row) => [row.nomefavorecido, Number(row.valor)]));

  it('userIds keeps only the selected guardador for Pago, like legacy', async () => {
    await seedLotePago(100, SELECIONADO, 200);
    await seedLotePago(110, OUTRO, 900);

    const [novo, antigo] = await Promise.all([
      aggregator.aggregate({ ...PERIODO, statuses: [StatusPagamento.PAGO], userIds: [SELECIONADO.id] }, 'guardador'),
      legacy.findConsolidadoNovoRemessa({ ...PERIODO, pago: true, userIds: [SELECIONADO.id] }),
    ]);

    expect(totais(novo)).toEqual({ [SELECIONADO.nome]: 200 });
    expect(totais(antigo)).toEqual(totais(novo));
  });

  it('userIds also restricts A Pagar never-grouped orders, like legacy', async () => {
    await seedOrdem(BASE_ID + 200, SELECIONADO, 30, null);
    await seedOrdem(BASE_ID + 201, OUTRO, 70, null);

    const [novo, antigo] = await Promise.all([
      aggregator.aggregate({ ...PERIODO, statuses: [StatusPagamento.A_PAGAR], userIds: [SELECIONADO.id] }, 'guardador'),
      legacy.findConsolidadoNovoRemessa({ ...PERIODO, aPagar: true, userIds: [SELECIONADO.id] }),
    ]);

    expect(totais(novo)).toEqual({ [SELECIONADO.nome]: 30 });
    expect(totais(antigo)).toEqual(totais(novo));
  });

  it('several userIds return one row per selected guardador, like legacy', async () => {
    await seedLotePago(300, SELECIONADO, 11);
    await seedLotePago(310, OUTRO, 22);

    const [novo, antigo] = await Promise.all([
      aggregator.aggregate({ ...PERIODO, statuses: [StatusPagamento.PAGO], userIds: [SELECIONADO.id, OUTRO.id] }, 'guardador'),
      legacy.findConsolidadoNovoRemessa({ ...PERIODO, pago: true, userIds: [SELECIONADO.id, OUTRO.id] }),
    ]);

    expect(totais(novo)).toEqual({ [SELECIONADO.nome]: 11, [OUTRO.nome]: 22 });
    expect(totais(antigo)).toEqual(totais(novo));
  });
});
