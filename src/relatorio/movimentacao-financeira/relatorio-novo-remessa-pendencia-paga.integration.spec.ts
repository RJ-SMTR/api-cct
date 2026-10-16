/**
 * Permissionário "Pendência Paga" coverage (Movimentação Financeira and Consolidado)
 * against a disposable PostgreSQL database (#1204).
 * Run with RUN_RETORNO_DB_TESTS=1 and DATABASE_HOST/PORT/USERNAME/PASSWORD/NAME pointing
 * to an isolated local test database. It never reads .env.
 */
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { RelatorioNovoRemessaConsolidadoRepository } from '../novo-remessa/relatorio-novo-remessa-consolidado.repository';
import { RelatorioNovoRemessaFinancialMovementService } from './relatorio-novo-remessa-financial-movement.service';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

const BASE_ID = 995000000;
const USER_ID = BASE_ID + 1;
const BANK_CODE = 99951;
const PARENT_ID = BASE_ID + 10;
// Filha whose orders never went to the bank: only a status-5 history, no detalhe_a.
const NEVER_SENT_CHILD_ID = BASE_ID + 11;
// Classic filha: its own failed attempt (detalhe_a) became status 5 when the pai was paid,
// plus a second status-5 history without detalhe_a.
const FAILED_CHILD_ID = BASE_ID + 12;
const PARENT_HISTORY_ID = BASE_ID + 20;
const NEVER_SENT_HISTORY_ID = BASE_ID + 21;
const FAILED_HISTORY_ID = BASE_ID + 22;
const FAILED_SECOND_HISTORY_ID = BASE_ID + 23;
const PARENT_DETAIL_ID = BASE_ID + 30;
const FAILED_DETAIL_ID = BASE_ID + 31;
const ORDER_IDS = [BASE_ID + 40, BASE_ID + 41, BASE_ID + 42];

const PAYMENT_DAY = '2099-03-10';

suite('Pendência Paga de permissionário (PostgreSQL)', () => {
  let dataSource: DataSource;
  let financialMovement: RelatorioNovoRemessaFinancialMovementService;
  let consolidado: RelatorioNovoRemessaConsolidadoRepository;

  beforeAll(async () => {
    jest.spyOn(CustomLogger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(CustomLogger.prototype, 'error').mockImplementation(() => undefined);
    dataSource = await new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT ?? 5432),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    }).initialize();
    financialMovement = new RelatorioNovoRemessaFinancialMovementService(dataSource, {} as any);
    consolidado = new RelatorioNovoRemessaConsolidadoRepository(dataSource);
  }, 60000);

  beforeEach(async () => {
    await cleanFixtures();
    await seedPaidPendingFamily();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanFixtures();
      await dataSource.destroy();
    }
  });

  async function cleanFixtures(): Promise<void> {
    await dataSource.query(`DELETE FROM detalhe_a WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM ordem_pagamento WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 99]);
    await dataSource.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM ordem_pagamento_agrupado WHERE id BETWEEN $1 AND $2`, [BASE_ID, BASE_ID + 99]);
    await dataSource.query(`DELETE FROM public."user" WHERE id = $1`, [USER_ID]);
    await dataSource.query(`DELETE FROM bank WHERE code = $1`, [BANK_CODE]);
  }

  async function seedPaidPendingFamily(): Promise<void> {
    await dataSource.query(
      `INSERT INTO bank (ispb, name, code, "fullName", "isAllowed") VALUES (0, 'BANCO TESTE', $1, 'BANCO TESTE', true)`,
      [BANK_CODE],
    );
    await dataSource.query(
      `INSERT INTO public."user" (
        id, email, provider, "fullName", "roleId", "permitCode", "cpfCnpj",
        "bankCode", "bankAgency", "bankAccount", "bankAccountDigit", bloqueado, "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'email', 'PERMISSIONARIO PENDENCIA PAGA', 2, '819950001', '99999999501',
        $3, '0001', '99990001', '1', false, now(), now())`,
      [USER_ID, `permissionario-${USER_ID}@example.test`, BANK_CODE],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "pagadorId", "ordemPagamentoAgrupadoId")
       VALUES ($1, DATE '${PAYMENT_DAY}', 300, NULL, NULL),
              ($2, DATE '${PAYMENT_DAY}', 200, NULL, $1),
              ($3, DATE '2099-03-03', 100, NULL, $1)`,
      [PARENT_ID, NEVER_SENT_CHILD_ID, FAILED_CHILD_ID],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento (id, "dataOrdem", valor, "userId", "nomeConsorcio", "operadoraCpfCnpj", "bqUpdatedAt", "dataCaptura", "ordemPagamentoAgrupadoId")
       VALUES ($1, DATE '2099-03-05', 120, $4, 'STPL', '99999999501', now(), DATE '2099-03-05', $5),
              ($2, DATE '2099-03-06', 80, $4, 'STPL', '99999999501', now(), DATE '2099-03-06', $5),
              ($3, DATE '2099-03-01', 100, $4, 'STPL', '99999999501', now(), DATE '2099-03-01', $6)`,
      [...ORDER_IDS, USER_ID, NEVER_SENT_CHILD_ID, FAILED_CHILD_ID],
    );
    await dataSource.query(
      `INSERT INTO ordem_pagamento_agrupado_historico (
        id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode",
        "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa"
      ) VALUES ($1, $5, DATE '${PAYMENT_DAY}', $8, '0001', '99990001', '1', 5, '00'),
              ($2, $6, DATE '${PAYMENT_DAY}', $8, '0001', '99990001', '1', 5, NULL),
              ($3, $7, DATE '2099-03-03', $8, '0001', '99990001', '1', 5, '02'),
              ($4, $7, DATE '${PAYMENT_DAY}', $8, '0001', '99990001', '1', 5, NULL)`,
      [PARENT_HISTORY_ID, NEVER_SENT_HISTORY_ID, FAILED_HISTORY_ID, FAILED_SECOND_HISTORY_ID, PARENT_ID, NEVER_SENT_CHILD_ID, FAILED_CHILD_ID, String(BANK_CODE)],
    );
    await dataSource.query(
      `INSERT INTO detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", nsr, "numeroDocumentoEmpresa", "dataVencimento", "valorLancamento", "valorRealEfetivado")
       VALUES ($1, $3, 1, 995001, DATE '${PAYMENT_DAY}', 300, 300),
              ($2, $4, 2, 995002, DATE '2099-03-03', 100, 100)`,
      [PARENT_DETAIL_ID, FAILED_DETAIL_ID, PARENT_HISTORY_ID, FAILED_HISTORY_ID],
    );
  }

  const day = () => ({ dataInicio: new Date(`${PAYMENT_DAY}T00:00:00Z`), dataFim: new Date(`${PAYMENT_DAY}T00:00:00Z`) });

  describe('Movimentação Financeira, Pendência Paga on the pai payment day', () => {
    it('includes the filha that never had its own remittance line, valued by its valorTotal', async () => {
      const summary = await financialMovement.findFinancialMovementSummary({ ...day(), pendenciaPaga: true, userIds: [USER_ID] });

      expect(summary.valorPendenciaPaga).toBeCloseTo(300, 2);
      expect(summary.count).toBe(2);
    });

    it('lists the never-sent filha once, dated by the pai payment', async () => {
      const page = await financialMovement.findFinancialMovementPage({ ...day(), pendenciaPaga: true, userIds: [USER_ID], pageSize: 50 } as any);
      const rows = (page as any).data.map((r: any) => [r.dataReferencia, Number(r.valor), r.status]).sort();

      expect(rows).toEqual([
        ['03/03/2099', 100, 'Pendencia Paga'],
        ['10/03/2099', 200, 'Pendencia Paga'],
      ]);
    });

    it('does not count the classic filha twice when it also has a status-5 history without remittance line', async () => {
      await dataSource.query(`DELETE FROM ordem_pagamento WHERE "ordemPagamentoAgrupadoId" = $1`, [NEVER_SENT_CHILD_ID]);

      const summary = await financialMovement.findFinancialMovementSummary({ ...day(), pendenciaPaga: true, userIds: [USER_ID] });

      expect(summary.count).toBe(1);
      expect(summary.valorPendenciaPaga).toBeCloseTo(100, 2);
    });
  });

  describe('Consolidado (Permissionário), favorecido selected', () => {
    it('finds the pendência paid through the pai, whose orders live in the filhas', async () => {
      const result = await consolidado.findConsolidado({ ...day(), userIds: [USER_ID], pendenciaPaga: true } as any);

      expect(result.data.map((r) => [r.nomefavorecido, r.valor])).toEqual([['PERMISSIONARIO PENDENCIA PAGA', 300]]);
    });
  });
});
