/**
 * Eleicao: Consolidado e Movimentacao Financeira legados precisam dar o mesmo total.
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
import { RelatorioGuardadorFinancialMovementRepository } from '../movimentacao-financeira/relatorio-guardador-financial-movement.repository';
import { RelatorioNovoRemessaFinancialMovementService } from '../movimentacao-financeira/relatorio-novo-remessa-financial-movement.service';
import { RelatorioNovoRemessaConsolidadoRepository } from '../novo-remessa/relatorio-novo-remessa-consolidado.repository';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 984000000;
const USER_A = BASE_ID + 1;
const USER_B = BASE_ID + 2;
const CPF = '98400000001';
const PERMIT_A = '4984000001';
const PERMIT_B = '7984000002';
const PERIODO = { dataInicio: new Date('2093-03-01T00:00:00.000Z'), dataFim: new Date('2093-03-31T00:00:00.000Z') };

jest.setTimeout(60000);

suite('Eleicao: Consolidado e Movimentacao Financeira legados (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let consolidado: RelatorioNovoRemessaConsolidadoRepository;
  let movimentacao: RelatorioNovoRemessaFinancialMovementService;

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
    consolidado = new RelatorioNovoRemessaConsolidadoRepository(dataSource);
    movimentacao = new RelatorioNovoRemessaFinancialMovementService(dataSource, new RelatorioGuardadorFinancialMovementRepository(dataSource));
  });

  beforeEach(async () => {
    await limpar();
    // Mesmo CPF em dois cadastros, com permitCodes diferentes (caso real de homologacao).
    for (const [id, permit, nome] of [
      [USER_A, PERMIT_A, 'ELEICAO PARIDADE TESTE'],
      [USER_B, PERMIT_B, 'ELEICAO PARIDADE TESTE'],
    ] as const) {
      await dataSource.query(
        `INSERT INTO public."user" (id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode", "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado, "createdAt", "updatedAt")
         VALUES ($1, $2, 'email', $3, 1, $4, $5, 104, '0001', '99990002', '1', false, now(), now())`,
        [id, `eleicao-paridade-${id}@example.test`, nome, CPF, permit],
      );
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await limpar();
    }
    await moduleRef?.close();
  });

  async function limpar(): Promise<void> {
    const faixa = [BASE_ID, BASE_ID + 999];
    await dataSource.query(`DELETE FROM ordem_pagamento_unico WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`DELETE FROM public."user" WHERE id IN ($1, $2)`, [USER_A, USER_B]);
  }

  async function seedEleicaoPaga(valor: number): Promise<void> {
    const opa = BASE_ID + 10;
    await dataSource.query(`INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt") VALUES ($1, DATE '2093-03-10', $2, NULL, now(), now())`, [opa, valor]);
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, DATE '2093-03-10', '104', '0001', '99990002', '1', 3, '00')`,
      [BASE_ID + 11, opa],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado", nsr, "createdAt", "updatedAt")
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $1, DATE '2093-03-10', $3, $3, $1, now(), now())`,
      [BASE_ID + 12, BASE_ID + 11, valor],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_unico (id, "idOrdemPagamento", "idOperadora", "operadoraCpfCnpj", "consorcio", "dataOrdem", "valorTotalTransacaoLiquido")
       VALUES ($1, $2, $3, $4, 'STPC', DATE '2093-03-05', $5)`,
      [BASE_ID + 13, String(opa), PERMIT_A, CPF, valor],
    );
  }

  async function seedEleicaoAPagar(valor: number): Promise<void> {
    await dataSource.query(
      `INSERT INTO ordem_pagamento_unico (id, "idOrdemPagamento", "idOperadora", "operadoraCpfCnpj", "consorcio", "dataOrdem", "valorTotalTransacaoLiquido")
       VALUES ($1, NULL, $2, $3, 'STPC', DATE '2093-03-12', $4)`,
      [BASE_ID + 20, PERMIT_A, CPF, valor],
    );
  }

  const totais = async (flags: Record<string, boolean>) => {
    const [c, m] = await Promise.all([
      consolidado.findConsolidado({ ...PERIODO, eleicao: true, todosVanzeiros: true, ...flags }),
      movimentacao.findFinancialMovementSummary({ ...PERIODO, eleicao: true, todosVanzeiros: true, ...flags } as any),
    ]);
    return { consolidado: Number(c.valor), movimentacao: Number(m.valorTotal) };
  };

  it('counts a paid Eleicao order once when the CPF has two registrations', async () => {
    await seedEleicaoPaga(85);

    expect(await totais({})).toEqual({ consolidado: 85, movimentacao: 85 });
  });

  it('shows never-sent Eleicao orders as A Pagar in both reports', async () => {
    await seedEleicaoPaga(85);
    await seedEleicaoAPagar(1197.67);

    expect(await totais({})).toEqual({ consolidado: 1282.67, movimentacao: 1282.67 });
    expect(await totais({ aPagar: true })).toEqual({ consolidado: 1197.67, movimentacao: 1197.67 });
    expect(await totais({ pago: true })).toEqual({ consolidado: 85, movimentacao: 85 });
  });
});
