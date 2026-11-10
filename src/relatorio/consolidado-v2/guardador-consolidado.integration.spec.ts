/**
 * Consolidado v2 (perfil Guardador) coverage against a disposable PostgreSQL database.
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

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

// Faixa propria, distinta dos demais specs de consolidado-v2 (992xxx a 995xxx).
const BASE_ID = 991000000;
const USER_ID = BASE_ID + 1;
const NOME = 'GUARDADOR CONSOLIDADO V2 TESTE';

suite('Consolidado v2 - perfil Guardador (PostgreSQL)', () => {
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
    await seedUser();
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
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM public."user" WHERE id = $1`, [USER_ID]);
  }

  // O legado exige roleId 6 (GUARDADOR_ROLE_ID); o banco local nao tem essa role por seed.
  async function seedUser(): Promise<void> {
    await dataSource.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
    await dataSource.query(
      `INSERT INTO public."user" (id, email, provider, "fullName", "roleId", "cpfCnpj", "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado, "createdAt", "updatedAt")
       VALUES ($1, $2, 'email', '${NOME}', 6, '99999999901', 104, '0001', '99990002', '1', false, now(), now())`,
      [USER_ID, `guardador-consolidado-v2-${USER_ID}@example.test`],
    );
  }

  async function seedOrdem(id: number, data: string, valor: number, opaId: number | null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_guardador (id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId", "tipoOrdemPagamento", "ordemPagamentoAgrupadoId", "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida", "createdAt", "updatedAt")
       VALUES ($1, DATE '${data}', DATE '${data}', $2, $3, 'AUTOMATICA', $4, 0, 0, 0, now(), now())`,
      [id, valor, USER_ID, opaId],
    );
  }

  async function seedAgrupado(id: number, dataPagamento: string, valor: number, paiId: number | null = null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '${dataPagamento}', $2, $3, now(), now())`,
      [id, valor, paiId],
    );
  }

  async function seedHistorico(id: number, opaId: number, data: string, status: number, motivo: string | null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, DATE '${data}', '104', '0001', '99990002', '1', $3, $4)`,
      [id, opaId, status, motivo],
    );
  }

  async function seedDetalhe(id: number, historicoId: number, vencimento: string, valor: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, DATE '${vencimento}', $4, $4, $3, now(), now())`,
      [id, historicoId, id - BASE_ID + 991000, valor],
    );
  }

  // Lote sem pai com um unico status: ordem + agrupado + historico + detalhe na mesma data.
  async function seedLote(offset: number, data: string, valor: number, status: number, motivo: string | null): Promise<void> {
    const opaId = BASE_ID + offset;
    await seedAgrupado(opaId, data, valor);
    await seedOrdem(BASE_ID + offset + 1, data, valor, opaId);
    await seedHistorico(BASE_ID + offset + 2, opaId, data, status, motivo);
    await seedDetalhe(BASE_ID + offset + 3, BASE_ID + offset + 2, data, valor);
  }

  async function seedPendenciaPagaFamilia(): Promise<void> {
    const paiId = BASE_ID + 300;
    const filhaId = BASE_ID + 301;
    await seedAgrupado(paiId, '2095-05-10', 500);
    await seedAgrupado(filhaId, '2095-01-01', 500, paiId);
    await seedOrdem(BASE_ID + 302, '2095-01-01', 500, filhaId);
    await seedHistorico(BASE_ID + 303, filhaId, '2095-01-01', 5, null);
    await seedDetalhe(BASE_ID + 304, BASE_ID + 303, '2095-05-10', 500);
  }

  const periodo = (inicio: string, fim: string) => ({
    dataInicio: new Date(`${inicio}T00:00:00.000Z`),
    dataFim: new Date(`${fim}T00:00:00.000Z`),
  });

  async function expectParidade(
    datas: { dataInicio: Date; dataFim: Date },
    statuses: StatusPagamento[],
    flagsLegado: Record<string, boolean>,
    valorEsperado: number,
  ): Promise<void> {
    const [novo, antigo] = await Promise.all([aggregator.aggregate({ ...datas, statuses }, 'guardador'), legacy.findConsolidadoNovoRemessa({ ...datas, ...flagsLegado })]);

    expect(novo.data).toHaveLength(1);
    expect(novo.data[0].nomefavorecido).toBe(NOME);
    expect(novo.data[0].valor).toBe(valorEsperado);
    expect(antigo.data).toHaveLength(1);
    expect(Number(antigo.data[0].valor)).toBe(novo.data[0].valor);
  }

  it('matches the legacy total for Pago + A Pagar + Aguardando Pagamento', async () => {
    await seedOrdem(BASE_ID + 10, '2095-03-10', 654, null);
    await seedLote(100, '2095-03-10', 200, 3, '00');
    await seedLote(110, '2095-03-11', 100, 2, null);

    await expectParidade(
      periodo('2095-03-01', '2095-03-31'),
      [StatusPagamento.PAGO, StatusPagamento.A_PAGAR, StatusPagamento.AGUARDANDO_PAGAMENTO],
      { pago: true, aPagar: true, emProcessamento: true },
      654 + 200 + 100,
    );
  });

  // O vencimento do detalhe fica dentro do periodo porque, em intervalo, o legado de Guardador
  // filtra Pendencia Paga por dataVencimento, enquanto a base v2 usa sempre a data do pai.
  it('matches the legacy total for Pendencia Paga (familia pai/filha)', async () => {
    await seedPendenciaPagaFamilia();

    await expectParidade(periodo('2095-05-01', '2095-05-31'), [StatusPagamento.PENDENCIA_PAGA], { pendenciaPaga: true }, 500);
  });

  it('matches the legacy total for Pendencia Paga alone on a single day', async () => {
    await seedPendenciaPagaFamilia();

    await expectParidade(periodo('2095-05-10', '2095-05-10'), [StatusPagamento.PENDENCIA_PAGA], { pendenciaPaga: true }, 500);
  });

  it('matches the legacy total for Rejeitado sem pai (dia unico)', async () => {
    await seedLote(200, '2001-06-10', 300, 4, 'AR');

    await expectParidade(periodo('2001-06-10', '2001-06-10'), [StatusPagamento.ERRO_REJEITADO], { rejeitado: true }, 300);
  });

  it('matches the legacy total for Estorno sem pai (dia unico)', async () => {
    await seedLote(210, '2001-07-10', 400, 4, '02');

    await expectParidade(periodo('2001-07-10', '2001-07-10'), [StatusPagamento.ERRO_ESTORNO], { estorno: true }, 400);
  });

  it('matches the legacy total for Rejeitado sem pai (intervalo)', async () => {
    await seedLote(220, '2001-08-10', 250, 4, 'AR');

    await expectParidade(periodo('2001-08-01', '2001-08-31'), [StatusPagamento.ERRO_REJEITADO], { rejeitado: true }, 250);
  });

  it('returns an empty result when the period has no Guardador orders', async () => {
    const result = await aggregator.aggregate(periodo('2095-12-01', '2095-12-31'), 'guardador');

    expect(result.count).toBe(0);
    expect(result.valor).toBe(0);
    expect(result.data).toEqual([]);
  });
});
