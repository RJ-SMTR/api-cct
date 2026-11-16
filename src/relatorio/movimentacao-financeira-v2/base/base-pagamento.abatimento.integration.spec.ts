/**
 * "Abatimento por duplicidade" in the v2 reports (Guardador), against a disposable PostgreSQL database.
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
import { StatusPagamento } from '../../enum/statusRemessafinancial-movement';
import { BasePagamentoRepository } from './base-pagamento.repository';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

// Own id/date range, apart from the other movimentacao-financeira integration specs.
const BASE_ID = 995500000;
const GUARDADOR_ID = BASE_ID + 1;
const OUTRO_GUARDADOR_ID = BASE_ID + 2;
const NOME = 'GUARDADOR ABATIMENTO V2 TESTE';
const OUTRO_NOME = 'GUARDADOR SEM INDEVIDO V2 TESTE';

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

suite('BasePagamentoRepository - Abatimento por duplicidade (PostgreSQL)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: BasePagamentoRepository;
  let proximoId = BASE_ID + 100;

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
    repository = new BasePagamentoRepository(dataSource);
  }, 60000);

  beforeEach(async () => {
    await limpar();
    await semear();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await limpar();
    await moduleRef?.close();
  });

  async function limpar(): Promise<void> {
    if (!dataSource?.isInitialized) return;
    const faixa = [BASE_ID, BASE_ID + 999];
    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`DELETE FROM ordem_pagamento_guardador WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`DELETE FROM pagamento_indevido WHERE id BETWEEN $1 AND $2`, faixa);
    await dataSource.query(`DELETE FROM public."user" WHERE id IN ($1, $2)`, [GUARDADOR_ID, OUTRO_GUARDADOR_ID]);
    proximoId = BASE_ID + 100;
  }

  async function inserirGuardador(id: number, nome: string, permitCode: string): Promise<void> {
    await dataSource.query(`INSERT INTO role (id, name) VALUES (6, 'agentes') ON CONFLICT (id) DO NOTHING`);
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "cpfCnpj", "permitCode",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado, "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'email', $3, 6, $4, $5, 104, '0001', '99990003', '1', false, now(), now())`,
      [id, `abatimento-v2-${id}@example.test`, nome, `9999999${String(id).slice(-4)}`, permitCode],
    );
  }

  // One grouping of the guardador with one order (devido) and one bank attempt (detalhe_a).
  async function pagamento(params: {
    userId: number;
    dataOrdem: string;
    devido: number;
    dataVencimento: string;
    valorLancamento: number;
    statusRemessa: number;
    motivo?: string | null;
  }): Promise<number> {
    const opa = proximoId++;
    const ordem = proximoId++;
    const historico = proximoId++;
    const detalhe = proximoId++;
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "ordemPagamentoAgrupadoId", "createdAt", "updatedAt")
       VALUES ($1, $2::date, $3, NULL, now(), now())`,
      [opa, params.dataVencimento, params.devido],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_guardador (
        id, "dataOrdem", "dataInclusao", "valorRepasseGuardador", "userId", "tipoOrdemPagamento", "ordemPagamentoAgrupadoId",
        "qtdVerificacaoTotal", "qtdVerificacaoValida", "qtdVerificacaoInvalida", "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2::date, $2::date, $3, $4, 'AUTOMATICA', $5, 0, 0, 0, now(), now())`,
      [ordem, params.dataOrdem, params.devido, params.userId, opa],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount",
        "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $2, $3::date, '104', '0001', '99990003', '1', $4, $5)`,
      [historico, opa, params.dataVencimento, params.statusRemessa, params.motivo ?? null],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (
        id, "ordemPagamentoAgrupadoHistoricoId", "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento",
        "valorRealEfetivado", nsr, "createdAt", "updatedAt"
      ) OVERRIDING SYSTEM VALUE VALUES ($1, $2, $1, $3::date, $4, $4, $1, now(), now())`,
      [detalhe, historico, params.dataVencimento, params.valorLancamento],
    );
    return detalhe;
  }

  // The guardador was paid twice for the order of 01/09/2097 (05/09 and again 12/09): R$ 100 paid too much,
  // discounted in October. A second guardador, without pagamento indevido, is paid less than due on the same day.
  async function semear(): Promise<void> {
    await inserirGuardador(GUARDADOR_ID, NOME, '9A1');
    await inserirGuardador(OUTRO_GUARDADOR_ID, OUTRO_NOME, '9A2');
    await dataSource.query(
      `INSERT INTO pagamento_indevido (id, "dataPagamento", "dataReferencia", "nomeFavorecido", "valorPago", "valorPagar", "saldoDevedor")
       VALUES ($1, DATE '2097-09-12', DATE '2097-10-10', $2, 200, 100, 0)`,
      [BASE_ID + 10, NOME],
    );

    // Duplicate payment of the same order (same day and value).
    await pagamento({ userId: GUARDADOR_ID, dataOrdem: '2097-09-01', devido: 100, dataVencimento: '2097-09-05', valorLancamento: 100, statusRemessa: 3, motivo: '00' });
    await pagamento({ userId: GUARDADOR_ID, dataOrdem: '2097-09-01', devido: 100, dataVencimento: '2097-09-12', valorLancamento: 100, statusRemessa: 3, motivo: '00' });

    // October: partial discount (paid 40 of 100), payment zeroed by the discount and rejected (AR), regular payment.
    await pagamento({ userId: GUARDADOR_ID, dataOrdem: '2097-10-01', devido: 100, dataVencimento: '2097-10-03', valorLancamento: 40, statusRemessa: 3, motivo: '00' });
    await pagamento({ userId: GUARDADOR_ID, dataOrdem: '2097-10-08', devido: 60, dataVencimento: '2097-10-10', valorLancamento: 0, statusRemessa: 4, motivo: 'AR' });
    await pagamento({ userId: GUARDADOR_ID, dataOrdem: '2097-10-15', devido: 80, dataVencimento: '2097-10-17', valorLancamento: 80, statusRemessa: 3, motivo: '00' });

    // Paid less than due, but without pagamento indevido: stays "Pago".
    await pagamento({ userId: OUTRO_GUARDADOR_ID, dataOrdem: '2097-10-01', devido: 100, dataVencimento: '2097-10-03', valorLancamento: 70, statusRemessa: 3, motivo: '00' });
  }

  const outubro = { dataInicio: dia('2097-10-01'), dataFim: dia('2097-10-31'), userIds: [GUARDADOR_ID, OUTRO_GUARDADOR_ID] };
  const linhaResumo = (row: { dataReferencia: Date; nomes: string; valor: string; status: string; motivo?: string | null }) => ({
    data: new Date(row.dataReferencia).toISOString().slice(0, 10),
    nome: row.nomes,
    valor: Number(row.valor),
    status: row.status,
    motivo: row.motivo ?? null,
  });

  it('marca o pagamento com abatimento (parcial e zerado) como "Abatimento por duplicidade", com o mes da duplicidade no motivo', async () => {
    const rows = (await repository.findGroupedRows('guardador', outubro)).map(linhaResumo);

    expect(rows).toEqual(
      expect.arrayContaining([
        { data: '2097-10-03', nome: NOME, valor: 40, status: StatusPagamento.ABATIMENTO_DUPLICIDADE, motivo: 'Valor pago em duplicidade em 09/2097' },
        { data: '2097-10-10', nome: NOME, valor: 0, status: StatusPagamento.ABATIMENTO_DUPLICIDADE, motivo: 'Valor pago em duplicidade em 09/2097' },
        { data: '2097-10-17', nome: NOME, valor: 80, status: StatusPagamento.PAGO, motivo: null },
        { data: '2097-10-03', nome: OUTRO_NOME, valor: 70, status: StatusPagamento.PAGO, motivo: null },
      ]),
    );
    expect(rows).toHaveLength(4);
  });

  it('filtra so o abatimento, e "Pago" deixa de trazer as linhas abatidas', async () => {
    const abatimento = await repository.findGroupedRows('guardador', { ...outubro, statuses: [StatusPagamento.ABATIMENTO_DUPLICIDADE] });
    const pago = await repository.findGroupedRows('guardador', { ...outubro, statuses: [StatusPagamento.PAGO] });

    expect(abatimento.map((row) => Number(row.valor)).sort((a, b) => a - b)).toEqual([0, 40]);
    expect(pago.map((row) => Number(row.valor)).sort((a, b) => a - b)).toEqual([70, 80]);
  });

  it('soma o abatimento no proprio total, fora do Valor Pago', async () => {
    const totais = await repository.findSummaryTotals('guardador', outubro);

    expect(totais.valorAbatimentoDuplicidade).toBe(40);
    expect(totais.valorPago).toBe(150);
    expect(totais.valorRejeitado).toBe(0);
    expect(totais.valorTotal).toBe(190);
  });

  it('no filtro de dia unico, o zerado pelo abatimento sai uma vez, como abatimento e nao como Rejeitado', async () => {
    const rows = (await repository.findGroupedRows('guardador', { ...outubro, dataInicio: dia('2097-10-10'), dataFim: dia('2097-10-10') })).map(linhaResumo);

    expect(rows).toEqual([{ data: '2097-10-10', nome: NOME, valor: 0, status: StatusPagamento.ABATIMENTO_DUPLICIDADE, motivo: 'Valor pago em duplicidade em 09/2097' }]);
  });

  it('Consolidado por status: um bloco para o abatimento', async () => {
    const linhas = await repository.findTotaisPorFavorecidoEStatus('guardador', {
      ...outubro,
      statuses: [StatusPagamento.PAGO, StatusPagamento.ABATIMENTO_DUPLICIDADE],
    });

    expect(linhas.find((linha) => linha.nome === NOME && linha.status === StatusPagamento.ABATIMENTO_DUPLICIDADE)?.valor).toBe(40);
    expect(linhas.find((linha) => linha.nome === NOME && linha.status === StatusPagamento.PAGO)?.valor).toBe(80);
  });

  it('pagina pelo cursor sem perder nem repetir as linhas de abatimento', async () => {
    const vistas: string[] = [];
    let cursor;
    for (;;) {
      const page = await repository.findGroupedRowsPage('guardador', outubro, 1, cursor);
      vistas.push(...page.rows.map((row) => `${row.chaveLinha}`));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(vistas).toHaveLength(4);
    expect(new Set(vistas).size).toBe(4);
  });
});
