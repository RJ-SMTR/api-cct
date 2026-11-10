/**
 * ConsorcioAggregatorService coverage against a disposable PostgreSQL database.
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
import { BasePagamentoRepository } from '../movimentacao-financeira-v2/base/base-pagamento.repository';
import { RelatorioNovoRemessaConsolidadoRepository } from '../novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { ConsorcioAggregatorService } from './consorcio-aggregator.service';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

// Distinct id/date range from the other movimentacao-financeira-v2/consolidado-v2 integration
// specs, to avoid any cross-contamination when the suites run against the same local database.
const BASE_ID = 994000000;
const PLAIN_USER_ID = BASE_ID + 1;
const VLT_USER_ID = BASE_ID + 2;

suite('ConsorcioAggregatorService (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let aggregator: ConsorcioAggregatorService;
  let legacyConsolidadoRepository: RelatorioNovoRemessaConsolidadoRepository;

  beforeAll(async () => {
    // Same workaround as base-pagamento.repository.integration.spec.ts and
    // vanzeiro-aggregator.service.integration.spec.ts (CustomLogger.getTimestamp depends on a
    // global set by test/global-setup.ts that isn't reliably present in every worker process).
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
    aggregator = new ConsorcioAggregatorService(new BasePagamentoRepository(dataSource));
    legacyConsolidadoRepository = new RelatorioNovoRemessaConsolidadoRepository(dataSource);
  }, 60000);

  beforeEach(async () => {
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

    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 999]);
    await dataSource.query(`DELETE FROM public."user" WHERE id IN ($1, $2)`, [PLAIN_USER_ID, VLT_USER_ID]);
  }

  async function seedPlainUser(): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'PERMISSIONARIO CONSORCIO V2 TESTE', 1, '99999999701',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [PLAIN_USER_ID, `consorcio-v2-${PLAIN_USER_ID}@example.test`],
    );
  }

  // permitCode='8' resolves to VLT via the shared CASE, regardless of the raw nomeConsorcio.
  async function seedVltUser(): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 'email', 'PERMISSIONARIO VLT V2 TESTE', 1, '99999999702', '8',
        104, '0001', '99990002', '1', false, now(), now()
      )`,
      [VLT_USER_ID, `vlt-v2-${VLT_USER_ID}@example.test`],
    );
  }

  async function seedAPagarOrder(userId: number, orderId: number, dataOrdem: string, valor: number, nomeConsorcioBruto: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento (
        id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '${dataOrdem}', DATE '${dataOrdem}', $2, now(), $3, $4, NULL, now(), now())`,
      [orderId, valor, userId, nomeConsorcioBruto],
    );
  }

  it('falls back to the raw nomeConsorcio (ELSE) when permitCode does not match any pattern', async () => {
    await seedPlainUser();
    await seedAPagarOrder(PLAIN_USER_ID, BASE_ID + 40, '2096-07-10', 321, 'CONSORCIO TESTE');

    const result = await aggregator.aggregate(
      {
        dataInicio: new Date('2096-07-10T00:00:00.000Z'),
        dataFim: new Date('2096-07-10T00:00:00.000Z'),
      },
      { consorcioNome: ['CONSORCIO TESTE'] },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].nomefavorecido).toBe('CONSORCIO TESTE');
    expect(result.data[0].valor).toBe(321);
  });

  it('resolves nomeConsorcio to VLT via permitCode, overriding the raw nomeConsorcio column', async () => {
    await seedVltUser();
    await seedAPagarOrder(VLT_USER_ID, BASE_ID + 41, '2096-07-11', 888, 'CONSORCIO BRUTO DIVERGENTE');

    const result = await aggregator.aggregate(
      {
        dataInicio: new Date('2096-07-11T00:00:00.000Z'),
        dataFim: new Date('2096-07-11T00:00:00.000Z'),
      },
      { consorcioNome: ['VLT'] },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].nomefavorecido).toBe('VLT');
    expect(result.data[0].valor).toBe(888);
  });

  // ADR 0011: an agrupamento with N child orders must count the lote value once, not N times.
  async function seedFanOutFamily(): Promise<void> {
    const opaId = BASE_ID + 310;
    const historyId = BASE_ID + 320;
    const detailId = BASE_ID + 330;
    const childOrderIds = [BASE_ID + 341, BASE_ID + 342, BASE_ID + 343];

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (
        id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
      ) VALUES ($1, DATE '2096-09-10', 5548.80, NULL, now(), now())`,
      [opaId],
    );

    for (const childOrderId of childOrderIds) {
      await dataSource.query(
        `INSERT INTO ordem_pagamento (
          id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt"
        ) VALUES ($1, DATE '2096-09-05', 1849.60, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
        [childOrderId, PLAIN_USER_ID, opaId],
      );
    }

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, DATE '2096-09-10', '104', '0001', '99990002', '1', 3, '00')`,
      [historyId, opaId],
    );

    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa",
        "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr,
        "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, 994003, DATE '2096-09-10', 5548.80, 5548.80, 994003, now(), now())`,
      [detailId, historyId],
    );
  }

  it('counts the lote value once for the consorcio total, not once per child order (ADR 0011)', async () => {
    await seedPlainUser();
    await seedFanOutFamily();

    const result = await aggregator.aggregate(
      {
        dataInicio: new Date('2096-09-10T00:00:00.000Z'),
        dataFim: new Date('2096-09-10T00:00:00.000Z'),
      },
      { consorcioNome: ['CONSORCIO TESTE'] },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].nomefavorecido).toBe('CONSORCIO TESTE');
    expect(result.data[0].valor).toBe(5548.8);
  });

  // Parity: same filter/fixtures, against the legacy Consolidado's public findConsolidado -
  // consorcioNome (not todosConsorcios, which restricts to CONSORCIOS) matches 'CONSORCIO
  // TESTE' directly, same as the base-pagamento/vanzeiro-aggregator parity tests use userIds to
  // bypass MODAIS_FILTER/NOT_CPF_FILTER (keyed off a different condition for consorcio vs.
  // favorecido - ver T2-summary.md do ADR 0021 - mas aqui o eixo em teste e o de consorcio).
  it('matches the legacy Consolidado totals per consorcio (A Pagar + Pago, fan-out dedupe)', async () => {
    await seedPlainUser();
    await seedAPagarOrder(PLAIN_USER_ID, BASE_ID + 40, '2096-07-10', 321, 'CONSORCIO TESTE');
    await seedFanOutFamily();

    const filter = {
      dataInicio: new Date('2096-07-01T00:00:00.000Z'),
      dataFim: new Date('2096-09-30T00:00:00.000Z'),
      consorcioNome: ['CONSORCIO TESTE'],
      pago: true,
      aPagar: true,
      emProcessamento: true,
    };

    const [newResult, legacyResult] = await Promise.all([
      aggregator.aggregate(filter, { consorcioNome: ['CONSORCIO TESTE'] }),
      legacyConsolidadoRepository.findConsolidado(filter),
    ]);

    expect(newResult.data).toHaveLength(1);
    expect(legacyResult.data).toHaveLength(1);
    expect(newResult.data[0].valor).toBe(legacyResult.data[0].valor);
  });

  it('todosConsorcios=true includes only consorcios from the fixed CONSORCIOS list', async () => {
    await seedVltUser();
    await seedPlainUser();
    // VLT (in CONSORCIOS) and 'CONSORCIO TESTE' (not in CONSORCIOS) on the same date.
    await seedAPagarOrder(VLT_USER_ID, BASE_ID + 41, '2096-07-12', 888, 'CONSORCIO BRUTO DIVERGENTE');
    await seedAPagarOrder(PLAIN_USER_ID, BASE_ID + 42, '2096-07-12', 321, 'CONSORCIO TESTE');

    const result = await aggregator.aggregate(
      {
        dataInicio: new Date('2096-07-12T00:00:00.000Z'),
        dataFim: new Date('2096-07-12T00:00:00.000Z'),
      },
      { todosConsorcios: true },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].nomefavorecido).toBe('VLT');
  });

  it('consorcioNome ignores case, like the legacy Consolidado', async () => {
    await seedVltUser();
    await seedAPagarOrder(VLT_USER_ID, BASE_ID + 41, '2096-07-13', 888, 'CONSORCIO BRUTO DIVERGENTE');

    const result = await aggregator.aggregate(
      {
        dataInicio: new Date('2096-07-13T00:00:00.000Z'),
        dataFim: new Date('2096-07-13T00:00:00.000Z'),
      },
      { consorcioNome: ['vlt'] },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].nomefavorecido).toBe('VLT');
  });

  // Pai + filha com status 5: data do pai, valor da filha (mesmo shape do spec de favorecido).
  async function seedPendenciaPagaFamily(): Promise<void> {
    const opaPaiId = BASE_ID + 500;
    const opaFilhaId = BASE_ID + 501;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2096-11-10', 500, NULL, now(), now())`,
      [opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2096-01-01', 500, $2, now(), now())`,
      [opaFilhaId, opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2096-01-01', 500, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
      [BASE_ID + 502, PLAIN_USER_ID, opaFilhaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
       VALUES ($1, $2, DATE '2096-01-01', '104', '0001', '99990002', '1', 5)`,
      [BASE_ID + 503, opaFilhaId],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, 994500, DATE '2096-01-01', 500, 500, 994500, now(), now())`,
      [BASE_ID + 504, BASE_ID + 503],
    );
  }

  // Filha paga nunca enviada em lote proprio: so o historico, sem detalhe_a.
  async function seedPendenciaPagaPasso0Family(): Promise<void> {
    const opaPaiId = BASE_ID + 510;
    const opaFilhaId = BASE_ID + 511;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2096-11-20', 650, NULL, now(), now())`,
      [opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2096-01-01', 650, $2, now(), now())`,
      [opaFilhaId, opaPaiId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2096-01-01', 650, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
      [BASE_ID + 512, PLAIN_USER_ID, opaFilhaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa")
       VALUES ($1, $2, DATE '2096-01-01', '104', '0001', '99990002', '1', 5)`,
      [BASE_ID + 513, opaFilhaId],
    );
  }

  // Rejeitado sem pai: unico formato em que a base v2 e o Consolidado legado usam a mesma linha.
  // Em familia, a base segue o status/data do pai (regra da Movimentacao Financeira) e o legado
  // usa o status/dataVencimento da propria filha - divergencia conhecida, ainda sem decisao.
  async function seedRejeitadoSemPai(): Promise<void> {
    const opaId = BASE_ID + 520;

    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2096-12-10', 300, NULL, now(), now())`,
      [opaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, DATE '2096-12-01', 300, now(), $2, 'CONSORCIO TESTE', $3, now(), now())`,
      [BASE_ID + 522, PLAIN_USER_ID, opaId],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, DATE '2096-12-10', '104', '0001', '99990002', '1', 4, 'AR')`,
      [BASE_ID + 523, opaId],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, 994520, DATE '2096-12-10', 300, 300, 994520, now(), now())`,
      [BASE_ID + 525, BASE_ID + 523],
    );
  }

  it('matches the legacy Consolidado total for Pendencia Paga, including PASSO 0 (consorcio)', async () => {
    await seedPlainUser();
    await seedPendenciaPagaFamily();
    await seedPendenciaPagaPasso0Family();

    const filter = {
      dataInicio: new Date('2096-11-01T00:00:00.000Z'),
      dataFim: new Date('2096-11-30T00:00:00.000Z'),
      consorcioNome: ['CONSORCIO TESTE'],
      pendenciaPaga: true,
    };

    const [newResult, legacyResult] = await Promise.all([
      aggregator.aggregate({ dataInicio: filter.dataInicio, dataFim: filter.dataFim, statuses: [StatusPagamento.PENDENCIA_PAGA] }, { consorcioNome: filter.consorcioNome }),
      legacyConsolidadoRepository.findConsolidado(filter),
    ]);

    expect(newResult.data).toHaveLength(1);
    expect(newResult.data[0].valor).toBe(500 + 650);
    expect(legacyResult.data).toHaveLength(1);
    expect(newResult.data[0].valor).toBe(legacyResult.data[0].valor);
  });

  it('matches the legacy Consolidado total for Rejeitado (consorcio)', async () => {
    await seedPlainUser();
    await seedRejeitadoSemPai();

    const filter = {
      dataInicio: new Date('2096-12-10T00:00:00.000Z'),
      dataFim: new Date('2096-12-10T00:00:00.000Z'),
      consorcioNome: ['CONSORCIO TESTE'],
      rejeitado: true,
    };

    const [newResult, legacyResult] = await Promise.all([
      aggregator.aggregate({ dataInicio: filter.dataInicio, dataFim: filter.dataFim, statuses: [StatusPagamento.ERRO_REJEITADO] }, { consorcioNome: filter.consorcioNome }),
      legacyConsolidadoRepository.findConsolidado(filter),
    ]);

    expect(newResult.data).toHaveLength(1);
    expect(newResult.data[0].valor).toBe(300);
    expect(legacyResult.data).toHaveLength(1);
    expect(newResult.data[0].valor).toBe(legacyResult.data[0].valor);
  });
});
