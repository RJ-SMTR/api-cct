/**
 * Consolidado Permissionario (visao por favorecido): paridade de userIds e pendentes contra o
 * findConsolidado legado. Run with RUN_RETORNO_DB_TESTS=1 only against an isolated local database.
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
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

jest.setTimeout(60000);

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 986200000;
const SELECIONADO = { id: BASE_ID + 1, nome: 'FAVORECIDO V2 SELECIONADO', cpf: '98620000001' };
const OUTRO = { id: BASE_ID + 2, nome: 'FAVORECIDO V2 OUTRO', cpf: '98620000002' };

const FUTURO = { dataInicio: new Date('2092-04-01T00:00:00.000Z'), dataFim: new Date('2092-04-30T00:00:00.000Z') };
// Passado: a regra de pendentes (regras-pendencia.ts) exige captura ha mais de 10 dias.
const PASSADO = { dataInicio: new Date('2026-08-01T00:00:00.000Z'), dataFim: new Date('2026-08-31T00:00:00.000Z') };
const DIA_FUTURO = '2092-04-10';
const DIA_PASSADO = '2026-08-14';

suite('Consolidado v2 - favorecido com userIds e pendentes (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let aggregator: VanzeiroAggregatorService;
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
    aggregator = new VanzeiroAggregatorService(new BasePagamentoRepository(dataSource));
    legacy = new RelatorioNovoRemessaConsolidadoRepository(dataSource);
  }, 60000);

  beforeEach(async () => {
    await cleanFixtures();
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
    await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, range);
  }

  async function seedUsuario(usuario: typeof SELECIONADO): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (id, email, provider, "fullName", "roleId", "cpfCnpj", "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado, "createdAt", "updatedAt")
       VALUES ($1, $2, 'email', $3, 1, $4, 104, '0001', '99990002', '1', false, now(), now())`,
      [usuario.id, `favorecido-v2-${usuario.id}@example.test`, usuario.nome, usuario.cpf],
    );
  }

  async function seedOrdem(id: number, usuario: typeof SELECIONADO, dia: string, valor: number, opaId: number | null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", "dataCaptura", valor, "bqUpdatedAt", "userId", "nomeConsorcio", "operadoraCpfCnpj", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $2::date, $3, now(), $4, 'STPC', $5, $6, now(), now())`,
      [id, dia, valor, usuario.id, usuario.cpf, opaId],
    );
  }

  async function seedAgrupado(id: number, dia: string, valor: number, paiId: number | null = null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, $4, now(), now())`,
      [id, dia, valor, paiId],
    );
  }

  async function seedHistoricoDetalhe(id: number, opaId: number, dia: string, valor: number, status: number, motivo: string | null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, $3::date, '104', '0001', '99990002', '1', $4, $5)`,
      [id, opaId, dia, status, motivo],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4::date, $5, $5, $3, now(), now())`,
      [id + 1, id, id - BASE_ID + 986200, dia, valor],
    );
  }

  async function seedLote(offset: number, usuario: typeof SELECIONADO, dia: string, valor: number, status = 3, motivo: string | null = '00'): Promise<void> {
    const opaId = BASE_ID + offset;
    await seedAgrupado(opaId, dia, valor);
    await seedOrdem(opaId + 1, usuario, dia, valor, opaId);
    await seedHistoricoDetalhe(opaId + 2, opaId, dia, valor, status, motivo);
  }

  // Filha paga pela pai: a data que vale e a do pagamento da pai.
  async function seedPendenciaPaga(offset: number, usuario: typeof SELECIONADO, dia: string, valor: number): Promise<void> {
    const paiId = BASE_ID + offset;
    const filhaId = paiId + 1;
    await seedAgrupado(paiId, dia, valor);
    await seedAgrupado(filhaId, '2092-03-10', valor, paiId);
    await seedOrdem(filhaId + 1, usuario, '2092-03-10', valor, filhaId);
    await seedHistoricoDetalhe(filhaId + 2, filhaId, dia, valor, 5, null);
  }

  const totais = (result: { data: { nomefavorecido: string; valor: number }[] }) =>
    Object.fromEntries(result.data.map((row) => [row.nomefavorecido, Number(row.valor)]));

  const soFixture = (mapa: Record<string, number>) =>
    Object.fromEntries(Object.entries(mapa).filter(([nome]) => nome === SELECIONADO.nome || nome === OUTRO.nome));

  it('userIds keeps only the selected favorecido for Pago, like legacy', async () => {
    await seedLote(100, SELECIONADO, DIA_FUTURO, 150);
    await seedLote(110, SELECIONADO, '2092-04-11', 50);
    await seedLote(120, OUTRO, DIA_FUTURO, 999);

    const [novo, antigo] = await Promise.all([
      aggregator.aggregate({ ...FUTURO, statuses: [StatusPagamento.PAGO], userIds: [SELECIONADO.id] }),
      legacy.findConsolidado({ ...FUTURO, pago: true, userIds: [SELECIONADO.id] }),
    ]);

    expect(totais(novo)).toEqual({ [SELECIONADO.nome]: 200 });
    expect(totais(antigo)).toEqual(totais(novo));
    expect(novo.valor).toBe(antigo.valor);
  });

  it('userIds covers Pendencia Paga through the order of the child, like legacy', async () => {
    await seedPendenciaPaga(200, SELECIONADO, DIA_FUTURO, 77);
    await seedPendenciaPaga(220, OUTRO, DIA_FUTURO, 888);

    const [novo, antigo] = await Promise.all([
      aggregator.aggregate({ ...FUTURO, statuses: [StatusPagamento.PENDENCIA_PAGA], userIds: [SELECIONADO.id] }),
      legacy.findConsolidado({ ...FUTURO, pendenciaPaga: true, userIds: [SELECIONADO.id] }),
    ]);

    expect(totais(novo)).toEqual({ [SELECIONADO.nome]: 77 });
    expect(totais(antigo)).toEqual(totais(novo));
  });

  it('userIds with several ids returns one row per selected favorecido, like legacy', async () => {
    await seedLote(300, SELECIONADO, DIA_FUTURO, 10);
    await seedLote(310, OUTRO, DIA_FUTURO, 20);

    const [novo, antigo] = await Promise.all([
      aggregator.aggregate({ ...FUTURO, statuses: [StatusPagamento.PAGO], userIds: [SELECIONADO.id, OUTRO.id] }),
      legacy.findConsolidado({ ...FUTURO, pago: true, userIds: [SELECIONADO.id, OUTRO.id] }),
    ]);

    expect(totais(novo)).toEqual({ [SELECIONADO.nome]: 10, [OUTRO.nome]: 20 });
    expect(totais(antigo)).toEqual(totais(novo));
  });

  it('pendentes returns an eligible never-grouped order, with userIds, like legacy', async () => {
    await seedOrdem(BASE_ID + 400, SELECIONADO, DIA_PASSADO, 123.45, null);
    await seedOrdem(BASE_ID + 401, OUTRO, DIA_PASSADO, 543.21, null);

    const [novo, antigo] = await Promise.all([
      aggregator.aggregate({ ...PASSADO, statuses: [StatusPagamento.PENDENTES], userIds: [SELECIONADO.id] }),
      legacy.findConsolidado({ ...PASSADO, pendentes: true, userIds: [SELECIONADO.id] }),
    ]);

    expect(totais(novo)).toEqual({ [SELECIONADO.nome]: 123.45 });
    expect(totais(antigo)).toEqual(totais(novo));
  });

  it('pendentes with todosVanzeiros gives the fixture favorecidos the same totals as legacy', async () => {
    await seedOrdem(BASE_ID + 500, SELECIONADO, DIA_PASSADO, 11.11, null);
    await seedOrdem(BASE_ID + 501, OUTRO, DIA_PASSADO, 22.22, null);

    const [novo, antigo] = await Promise.all([
      aggregator.aggregate({ ...PASSADO, statuses: [StatusPagamento.PENDENTES] }),
      legacy.findConsolidado({ ...PASSADO, pendentes: true, todosVanzeiros: true }),
    ]);

    expect(soFixture(totais(novo))).toEqual({ [SELECIONADO.nome]: 11.11, [OUTRO.nome]: 22.22 });
    expect(soFixture(totais(antigo))).toEqual(soFixture(totais(novo)));
  });
});
