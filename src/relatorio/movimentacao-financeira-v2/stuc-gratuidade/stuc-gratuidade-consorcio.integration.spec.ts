/**
 * Filtro de consorcio do StucGratuidadeRepository, com paridade contra o ramo STUC do
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
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { RelatorioNovoRemessaConsolidadoRepository } from '../../novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { StucGratuidadeRepository } from './stuc-gratuidade.repository';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 986100000;
const INDIVIDUAL_MODAL = { id: BASE_ID + 1, nome: 'STUC FILTRO INDIVIDUAL MODAL', cpf: '98610000001', permitCode: null };
const EMPRESA_INTERSUL = { id: BASE_ID + 2, nome: 'STUC FILTRO EMPRESA INTERSUL', cpf: '98610000000102', permitCode: null };
const FORA_DA_LISTA = { id: BASE_ID + 3, nome: 'STUC FILTRO FORA DA LISTA', cpf: '98610000003', permitCode: null };
const PERMIT_STPC = { id: BASE_ID + 4, nome: 'STUC FILTRO PERMIT STPC', cpf: '98610000004', permitCode: '4986100' };
const USUARIOS = [INDIVIDUAL_MODAL, EMPRESA_INTERSUL, FORA_DA_LISTA, PERMIT_STPC];

const MES = { dataInicio: new Date('2093-03-01T00:00:00.000Z'), dataFim: new Date('2093-03-31T00:00:00.000Z') };
const DIA = '2093-03-06';
const UM_DIA = { dataInicio: new Date(`${DIA}T00:00:00.000Z`), dataFim: new Date(`${DIA}T00:00:00.000Z`) };

type Usuario = (typeof USUARIOS)[number];

suite('StucGratuidadeRepository - filtro de consorcio (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: StucGratuidadeRepository;
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
    repository = new StucGratuidadeRepository(dataSource);
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
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, range);
    await dataSource.query(`DELETE FROM public."user" WHERE id BETWEEN $1 AND $2`, range);
  }

  async function seedUsuario(usuario: Usuario): Promise<void> {
    await dataSource.query(
      `INSERT INTO public."user" (id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode", "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado, "createdAt", "updatedAt")
       VALUES ($1, $2, 'email', $3, 1, $4, $5, 104, '0001', '99990002', '1', false, now(), now())`,
      [usuario.id, `stuc-filtro-${usuario.id}@example.test`, usuario.nome, usuario.cpf, usuario.permitCode],
    );
  }

  async function seedAgrupado(id: number, dataPagamento: string, valor: number, paiId: number | null = null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, $4, now(), now())`,
      [id, dataPagamento, valor, paiId],
    );
  }

  async function seedHistorico(id: number, opaId: number, status: number, motivo: string | null): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, now(), '104', '0001', '99990002', '1', $3, $4)`,
      [id, opaId, status, motivo],
    );
  }

  async function seedDetalhe(id: number, historicoId: number, vencimento: string, valor: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4::date, $5, $5, $3, now(), now())`,
      [id, historicoId, id - BASE_ID + 986100, vencimento, valor],
    );
  }

  async function seedOrdem(id: number, usuario: Usuario, nomeConsorcio: string, operadora: string | null, valor: number, opaId: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "valorGratuidade", "bqUpdatedAt", "userId", "nomeConsorcio", "operadoraCpfCnpj", "ordemPagamentoAgrupadoGratuidadeId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, $3, now(), $4, $5, $6, $7, now(), now())`,
      [id, DIA, valor, usuario.id, nomeConsorcio, operadora, opaId],
    );
  }

  // Lote sem pai: ordem + agrupado + historico + detalhe na mesma data.
  async function seedLote(offset: number, usuario: Usuario, nomeConsorcio: string, valor: number, operadora: string | null = usuario.cpf, status = 3, motivo: string | null = '00'): Promise<void> {
    const opaId = BASE_ID + offset;
    await seedAgrupado(opaId, DIA, valor);
    await seedHistorico(opaId + 1, opaId, status, motivo);
    await seedDetalhe(opaId + 2, opaId + 1, DIA, valor);
    await seedOrdem(opaId + 3, usuario, nomeConsorcio, operadora, valor, opaId);
  }

  async function seedPendenciaPaga(offset: number, usuario: Usuario, nomeConsorcio: string, valor: number): Promise<void> {
    const paiId = BASE_ID + offset;
    const filhaId = paiId + 1;
    await seedAgrupado(paiId, DIA, valor);
    await seedAgrupado(filhaId, '2093-02-10', valor, paiId);
    await seedHistorico(filhaId + 1, filhaId, 5, null);
    await seedDetalhe(filhaId + 2, filhaId + 1, DIA, valor);
    await seedOrdem(filhaId + 3, usuario, nomeConsorcio, usuario.cpf, valor, filhaId);
  }

  async function seedQuatroPerfis(): Promise<void> {
    await seedLote(100, INDIVIDUAL_MODAL, 'STPC', 10);
    await seedLote(110, EMPRESA_INTERSUL, 'Intersul', 20);
    await seedLote(120, FORA_DA_LISTA, 'CONSORCIO FORA DA LISTA', 40);
    // permitCode 4% rotula STPC, mas a coluna bruta nao esta na lista fixa.
    await seedLote(130, PERMIT_STPC, 'XYZ', 80);
  }

  const totaisNovo = (rows: { nomes: string; valor: number }[]) => Object.fromEntries(rows.map((row) => [row.nomes, row.valor]));
  const totaisLegado = (result: { data: { nomefavorecido: string; valor: number }[] }) =>
    Object.fromEntries(result.data.map((row) => [row.nomefavorecido, Number(row.valor)]));

  const legacyFilter = (overrides: Record<string, unknown>) => ({ ...MES, stucGratuidade: true, pago: true, ...overrides }) as any;

  it('consorcioNome specific ignores case and surrounding spaces, like legacy', async () => {
    await seedQuatroPerfis();

    const [novo, antigo] = await Promise.all([
      repository.findRows({ ...MES, statuses: [StatusPagamento.PAGO], consorcioNome: [' intersul '] }),
      legacy.findConsolidado(legacyFilter({ consorcioNome: [' intersul '] })),
    ]);

    expect(totaisNovo(novo)).toEqual({ [EMPRESA_INTERSUL.nome]: 20 });
    expect(totaisLegado(antigo)).toEqual(totaisNovo(novo));
  });

  it('consorcioNome compares the resolved label (permitCode wins over the raw column), like legacy', async () => {
    await seedQuatroPerfis();

    const [novo, antigo] = await Promise.all([
      repository.findRows({ ...MES, statuses: [StatusPagamento.PAGO], consorcioNome: ['stpc'] }),
      legacy.findConsolidado(legacyFilter({ consorcioNome: ['stpc'] })),
    ]);

    expect(totaisNovo(novo)).toEqual({ [INDIVIDUAL_MODAL.nome]: 10, [PERMIT_STPC.nome]: 80 });
    expect(totaisLegado(antigo)).toEqual(totaisNovo(novo));
  });

  it('todosConsorcios is limited to the fixed CONSORCIOS list on the raw column, like legacy', async () => {
    await seedQuatroPerfis();

    const [novo, antigo] = await Promise.all([
      repository.findRows({ ...MES, statuses: [StatusPagamento.PAGO], todosConsorcios: true }),
      legacy.findConsolidado(legacyFilter({ todosConsorcios: true })),
    ]);

    expect(totaisNovo(novo)).toEqual({ [INDIVIDUAL_MODAL.nome]: 10, [EMPRESA_INTERSUL.nome]: 20 });
    expect(totaisLegado(antigo)).toEqual(totaisNovo(novo));
  });

  it('todosConsorcios wins when consorcioNome is sent too, like legacy', async () => {
    await seedQuatroPerfis();

    const [novo, antigo] = await Promise.all([
      repository.findRows({ ...MES, statuses: [StatusPagamento.PAGO], todosConsorcios: true, consorcioNome: ['Intersul'] }),
      legacy.findConsolidado(legacyFilter({ todosConsorcios: true, consorcioNome: ['Intersul'] })),
    ]);

    expect(totaisNovo(novo)).toEqual({ [INDIVIDUAL_MODAL.nome]: 10, [EMPRESA_INTERSUL.nome]: 20 });
    expect(totaisLegado(antigo)).toEqual(totaisNovo(novo));
  });

  it('todosConsorcios matches legacy with both "todos" flags: the modal CPF only changes branch', async () => {
    await seedQuatroPerfis();

    const [novo, antigo] = await Promise.all([
      repository.findRows({ ...MES, statuses: [StatusPagamento.PAGO], todosConsorcios: true }),
      legacy.findConsolidado(legacyFilter({ todosConsorcios: true, todosVanzeiros: true })),
    ]);

    expect(totaisNovo(novo)).toEqual({ [INDIVIDUAL_MODAL.nome]: 10, [EMPRESA_INTERSUL.nome]: 20 });
    expect(totaisLegado(antigo)).toEqual(totaisNovo(novo));
  });

  // Divergencia medida: com os dois "todos", o legado perde a linha modal sem operadoraCpfCnpj
  // (NULL cai fora dos dois ramos). O v2 mantem o que o legado devolve com todosConsorcios sozinho.
  it('divergence: a modal row without operadoraCpfCnpj is dropped by legacy only with both "todos" flags', async () => {
    await seedLote(140, INDIVIDUAL_MODAL, 'STPC', 30, null);

    const [novo, soConsorcios, ambos] = await Promise.all([
      repository.findRows({ ...MES, statuses: [StatusPagamento.PAGO], todosConsorcios: true }),
      legacy.findConsolidado(legacyFilter({ todosConsorcios: true })),
      legacy.findConsolidado(legacyFilter({ todosConsorcios: true, todosVanzeiros: true })),
    ]);

    expect(totaisNovo(novo)).toEqual({ [INDIVIDUAL_MODAL.nome]: 30 });
    expect(totaisLegado(soConsorcios)).toEqual({ [INDIVIDUAL_MODAL.nome]: 30 });
    expect(totaisLegado(ambos)).toEqual({});
  });

  it('applies the consorcio filter to Pendencia Paga, like legacy', async () => {
    await seedPendenciaPaga(200, EMPRESA_INTERSUL, 'Intersul', 21);
    await seedPendenciaPaga(220, FORA_DA_LISTA, 'CONSORCIO FORA DA LISTA', 41);

    const [novo, antigo] = await Promise.all([
      repository.findRows({ ...MES, statuses: [StatusPagamento.PENDENCIA_PAGA], consorcioNome: ['INTERSUL'] }),
      legacy.findConsolidado({ ...MES, stucGratuidade: true, pendenciaPaga: true, consorcioNome: ['INTERSUL'] } as any),
    ]);

    expect(totaisNovo(novo)).toEqual({ [EMPRESA_INTERSUL.nome]: 21 });
    expect(totaisLegado(antigo)).toEqual(totaisNovo(novo));
  });

  it('applies the consorcio filter to Rejeitado on a single day, like legacy', async () => {
    await seedLote(300, EMPRESA_INTERSUL, 'Intersul', 22, EMPRESA_INTERSUL.cpf, 4, 'AR');
    await seedLote(310, FORA_DA_LISTA, 'CONSORCIO FORA DA LISTA', 42, FORA_DA_LISTA.cpf, 4, 'AR');

    const [novo, antigo] = await Promise.all([
      repository.findRows({ ...UM_DIA, statuses: [StatusPagamento.ERRO_REJEITADO], todosConsorcios: true }),
      legacy.findConsolidado({ ...UM_DIA, stucGratuidade: true, rejeitado: true, todosConsorcios: true } as any),
    ]);

    expect(totaisNovo(novo)).toEqual({ [EMPRESA_INTERSUL.nome]: 22 });
    expect(totaisLegado(antigo)).toEqual(totaisNovo(novo));
  });

  it('without a consorcio filter keeps returning every consorcio', async () => {
    await seedQuatroPerfis();

    const novo = await repository.findRows({ ...MES, statuses: [StatusPagamento.PAGO] });

    expect(totaisNovo(novo)).toEqual({
      [INDIVIDUAL_MODAL.nome]: 10,
      [EMPRESA_INTERSUL.nome]: 20,
      [FORA_DA_LISTA.nome]: 40,
      [PERMIT_STPC.nome]: 80,
    });
  });
});
