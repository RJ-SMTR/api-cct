/**
 * Disposable local PostgreSQL, no application bootstrap or production credentials.
 * Uses real (non-temp) `public` schema objects because the procedure body
 * hardcodes the `public.` prefix — session-local pg_temp tables would not be
 * visible to it.
 *
 * GUARDADOR_PENDENTE_TEST_PORT=55441 npx jest guardador-pendente-procedure.integration --runInBand
 */
import { DataSource } from 'typeorm';
import { RewriteGuardadorPendenteProcedure1786400000000 } from '../../../database/migrations/1786400000000-RewriteGuardadorPendenteProcedure';
import { GuardadorPendenteSkipUnchangedBankData1786500000000 } from '../../../database/migrations/1786500000000-GuardadorPendenteSkipUnchangedBankData';

const suite = process.env.GUARDADOR_PENDENTE_TEST_PORT ? describe : describe.skip;

suite('p_agrupar_ordens_guardador_pendente (PostgreSQL)', () => {
  let ds: DataSource;

  /** Minimal QueryRunner shim — migrations here only call queryRunner.query(). */
  const runner = { query: (sql: string) => ds.query(sql) } as unknown as Parameters<
    RewriteGuardadorPendenteProcedure1786400000000['up']
  >[0];

  /** Reinstalls the unmodified 1786400000000 procedure body, undoing 1786500000000. */
  async function installBaselineProcedure() {
    await new RewriteGuardadorPendenteProcedure1786400000000().up(runner);
  }

  /** Installs 1786500000000 on top — the version under test by default. */
  async function installBankDataSkipProcedure() {
    await new GuardadorPendenteSkipUnchangedBankData1786500000000().up(runner);
  }

  beforeAll(async () => {
    ds = await new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: Number(process.env.GUARDADOR_PENDENTE_TEST_PORT),
      username: 'postgres',
      password: 'postgres',
      database: 'postgres',
      entities: [],
      synchronize: false,
    }).initialize();

    await ds.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    await ds.query(`
      CREATE TABLE public."user" (
        id integer PRIMARY KEY,
        "bloqueado" boolean,
        "bankCode" integer,
        "bankAgency" varchar(5),
        "bankAccount" varchar(20),
        "bankAccountDigit" varchar(2)
      );
      CREATE TABLE public.ordem_pagamento_guardador (
        id integer PRIMARY KEY,
        "userId" integer NOT NULL,
        "dataOrdem" date NOT NULL,
        "valorRepasseGuardador" numeric(13,5) NOT NULL,
        "ordemPagamentoAgrupadoId" integer
      );
      CREATE TABLE public.ordem_pagamento_agrupado (
        id bigserial PRIMARY KEY,
        "dataPagamento" timestamp NOT NULL,
        "valorTotal" numeric(13,5) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "pagadorId" integer,
        "ordemPagamentoAgrupadoId" integer
      );
      CREATE TABLE public.ordem_pagamento_agrupado_historico (
        id bigserial PRIMARY KEY,
        "ordemPagamentoAgrupadoId" integer NOT NULL,
        "dataReferencia" timestamp NOT NULL,
        "userBankCode" varchar(10),
        "userBankAgency" varchar(5),
        "userBankAccount" varchar(20),
        "userBankAccountDigit" varchar(2),
        "statusRemessa" integer NOT NULL,
        "motivoStatusRemessa" varchar(2)
      );
      CREATE TABLE public.detalhe_a (
        id integer PRIMARY KEY,
        "ordemPagamentoAgrupadoHistoricoId" integer NOT NULL,
        "dataVencimento" date,
        "valorLancamento" numeric(13,2),
        "valorRealEfetivado" numeric(13,2)
      );
    `);

    // Mirror real deployment order: 1786400000000 then 1786500000000 on top.
    await installBaselineProcedure();
    await installBankDataSkipProcedure();
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      await ds.destroy();
    }
  });

  beforeEach(async () => {
    await ds.query(`
      TRUNCATE public.detalhe_a, public.ordem_pagamento_agrupado_historico,
        public.ordem_pagamento_agrupado, public.ordem_pagamento_guardador, public."user"
      RESTART IDENTITY;
    `);
  });

  async function seedUser(overrides: Partial<{
    id: number; bloqueado: boolean | null; bankCode: number | null;
    bankAgency: string | null; bankAccount: string | null; bankAccountDigit: string | null;
  }>) {
    const u = { id: 1, bloqueado: null, bankCode: 1, bankAgency: '1', bankAccount: '12345', bankAccountDigit: '1', ...overrides };
    await ds.query(
      `INSERT INTO public."user" (id, "bloqueado", "bankCode", "bankAgency", "bankAccount", "bankAccountDigit")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [u.id, u.bloqueado, u.bankCode, u.bankAgency, u.bankAccount, u.bankAccountDigit],
    );
  }

  /** A leaf OPA with an ordem_pagamento_guardador row, plus one real-failure
   * history row (statusRemessa/motivo + a matching detalhe_a). */
  async function seedRealFailureLeafOpa(opts: {
    opaId: number; opgId: number; userId: number; historicoId: number; detalheAId: number;
    dataReferencia: string; statusRemessa: number; motivoStatusRemessa: string;
    userBankCode: string; userBankAgency: string; userBankAccount: string; userBankAccountDigit: string;
    valor?: number;
  }) {
    const valor = opts.valor ?? 200.0;
    await ds.query(
      `INSERT INTO public.ordem_pagamento_guardador (id, "userId", "dataOrdem", "valorRepasseGuardador", "ordemPagamentoAgrupadoId")
       VALUES ($1, $2, $3, $4, $5)`,
      [opts.opgId, opts.userId, opts.dataReferencia, valor, opts.opaId],
    );
    await ds.query(
      `INSERT INTO public.ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "pagadorId")
       VALUES ($1, $2, $3, 1)`,
      [opts.opaId, opts.dataReferencia, valor],
    );
    await ds.query(
      `INSERT INTO public.ordem_pagamento_agrupado_historico
         (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [opts.historicoId, opts.opaId, opts.dataReferencia, opts.userBankCode, opts.userBankAgency, opts.userBankAccount, opts.userBankAccountDigit, opts.statusRemessa, opts.motivoStatusRemessa],
    );
    await ds.query(
      `INSERT INTO public.detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "dataVencimento", "valorLancamento", "valorRealEfetivado")
       VALUES ($1, $2, $3, $4, $4)`,
      [opts.detalheAId, opts.historicoId, opts.dataReferencia, valor],
    );
  }

  /** Whether the leaf OPA was re-parented (retried) by the last CALL. */
  async function wasRetried(opaId: number): Promise<boolean> {
    const [row] = await ds.query(
      `SELECT "ordemPagamentoAgrupadoId" AS pai_id FROM public.ordem_pagamento_agrupado WHERE id = $1`,
      [opaId],
    );
    return row.pai_id !== null;
  }

  it('groups a never-grouped order (PASSO 0) and a real-failure order with different current bank data (PASSO 1)', async () => {
    // User 1: never grouped, complete bank data -> PASSO 0 candidate.
    await seedUser({ id: 1 });
    await ds.query(
      `INSERT INTO public.ordem_pagamento_guardador (id, "userId", "dataOrdem", "valorRepasseGuardador", "ordemPagamentoAgrupadoId")
       VALUES (1, 1, '2026-09-05', 150.00, NULL)`,
    );

    // User 2: real failure, current bank data differs from the failed attempt's snapshot -> must retry.
    await seedUser({ id: 2, bankAccount: '99999' });
    await ds.query(
      `INSERT INTO public.ordem_pagamento_guardador (id, "userId", "dataOrdem", "valorRepasseGuardador", "ordemPagamentoAgrupadoId")
       VALUES (2, 2, '2026-08-01', 200.00, 500)`,
    );
    await ds.query(
      `INSERT INTO public.ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "pagadorId")
       VALUES (500, '2026-08-05', 200.00, 1)`,
    );
    await ds.query(
      `INSERT INTO public.ordem_pagamento_agrupado_historico
         (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES (900, 500, '2026-08-05', '1', '1', '11111', '1', 4, 'AL')`,
    );
    await ds.query(
      `INSERT INTO public.detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "dataVencimento", "valorLancamento", "valorRealEfetivado")
       VALUES (1, 900, '2026-08-05', 200.00, 200.00)`,
    );

    await ds.query(
      `CALL p_agrupar_ordens_guardador_pendente($1, $2, $3, $4)`,
      ['2026-09-01', '2026-09-10', '2026-09-16', 1],
    );

    // ordem_pagamento_guardador always points at its "leaf" OPA; a pendente
    // round re-parents that leaf under a fresh "pai" via the OPA's own
    // self-referencing ordemPagamentoAgrupadoId, so that is what a retry
    // must be observed through.
    const leafOpaIds = (
      await ds.query(`SELECT "userId", "ordemPagamentoAgrupadoId" AS leaf_id FROM public.ordem_pagamento_guardador ORDER BY "userId"`)
    ) as { userId: number; leaf_id: number }[];
    expect(leafOpaIds).toEqual([
      { userId: 1, leaf_id: expect.any(Number) },
      { userId: 2, leaf_id: 500 },
    ]);

    const leafOpas = await ds.query(
      `SELECT id, "ordemPagamentoAgrupadoId" AS pai_id FROM public.ordem_pagamento_agrupado WHERE id = ANY($1::int[])`,
      [leafOpaIds.map((r) => r.leaf_id)],
    );
    for (const opa of leafOpas) {
      expect(opa.pai_id).not.toBeNull();
    }
  });

  it('BANK-1: excludes a real failure whose current bank data is identical to its last real-failure snapshot', async () => {
    await seedUser({ id: 3, bankCode: 1, bankAgency: '1', bankAccount: '11111', bankAccountDigit: '1' });
    await seedRealFailureLeafOpa({
      opaId: 600, opgId: 10, userId: 3, historicoId: 901, detalheAId: 10,
      dataReferencia: '2026-08-05', statusRemessa: 4, motivoStatusRemessa: 'AL',
      userBankCode: '1', userBankAgency: '1', userBankAccount: '11111', userBankAccountDigit: '1',
    });

    await ds.query(
      `CALL p_agrupar_ordens_guardador_pendente($1, $2, $3, $4)`,
      ['2026-09-01', '2026-09-10', '2026-09-16', 1],
    );

    expect(await wasRetried(600)).toBe(false);
  });

  it.each([
    ['bankCode', { bankCode: 2 }],
    ['bankAgency', { bankAgency: '2' }],
    ['bankAccount', { bankAccount: '22222' }],
    ['bankAccountDigit', { bankAccountDigit: '2' }],
  ] as const)('BANK-2: includes a real failure whose current %s differs from the last real-failure snapshot', async (_field, override) => {
    await seedUser({ id: 4, bankCode: 1, bankAgency: '1', bankAccount: '11111', bankAccountDigit: '1', ...override });
    await seedRealFailureLeafOpa({
      opaId: 601, opgId: 11, userId: 4, historicoId: 902, detalheAId: 11,
      dataReferencia: '2026-08-05', statusRemessa: 4, motivoStatusRemessa: 'AL',
      userBankCode: '1', userBankAgency: '1', userBankAccount: '11111', userBankAccountDigit: '1',
    });

    await ds.query(
      `CALL p_agrupar_ordens_guardador_pendente($1, $2, $3, $4)`,
      ['2026-09-01', '2026-09-10', '2026-09-16', 1],
    );

    expect(await wasRetried(601)).toBe(true);
  });

  it('BANK-3: a field that is NULL both currently and on the snapshot counts as unchanged', async () => {
    // Also reachable via BANK-4's completeness guard (current bankAgency is
    // NULL), but this asserts the comparison itself treats NULL=NULL as a
    // match rather than tripping on IS DISTINCT FROM with two NULL operands.
    await seedUser({ id: 5, bankCode: 1, bankAgency: null, bankAccount: '11111', bankAccountDigit: '1' });
    await seedRealFailureLeafOpa({
      opaId: 602, opgId: 12, userId: 5, historicoId: 903, detalheAId: 12,
      dataReferencia: '2026-08-05', statusRemessa: 4, motivoStatusRemessa: 'AL',
      userBankCode: '1', userBankAgency: null as unknown as string, userBankAccount: '11111', userBankAccountDigit: '1',
    });

    await ds.query(
      `CALL p_agrupar_ordens_guardador_pendente($1, $2, $3, $4)`,
      ['2026-09-01', '2026-09-10', '2026-09-16', 1],
    );

    expect(await wasRetried(602)).toBe(false);
  });

  it('BANK-4: excludes a real failure whose current bank data is now incomplete, even if it changed', async () => {
    await seedUser({ id: 6, bankCode: 1, bankAgency: null, bankAccount: '99999', bankAccountDigit: '1' });
    await seedRealFailureLeafOpa({
      opaId: 603, opgId: 13, userId: 6, historicoId: 904, detalheAId: 13,
      dataReferencia: '2026-08-05', statusRemessa: 4, motivoStatusRemessa: 'AL',
      userBankCode: '1', userBankAgency: '1', userBankAccount: '11111', userBankAccountDigit: '1',
    });

    await ds.query(
      `CALL p_agrupar_ordens_guardador_pendente($1, $2, $3, $4)`,
      ['2026-09-01', '2026-09-10', '2026-09-16', 1],
    );

    expect(await wasRetried(603)).toBe(false);
  });

  it('BANK-5: uses only the newest real-failure snapshot, ignoring an older failure and a status-0 grouping row in between', async () => {
    await seedUser({ id: 7, bankCode: 1, bankAgency: '1', bankAccount: '11111', bankAccountDigit: '1' });
    await seedRealFailureLeafOpa({
      // Older failure: different bank data than current — would mean "changed" if picked.
      opaId: 604, opgId: 14, userId: 7, historicoId: 905, detalheAId: 14,
      dataReferencia: '2026-07-01', statusRemessa: 4, motivoStatusRemessa: 'AL',
      userBankCode: '1', userBankAgency: '1', userBankAccount: '99999', userBankAccountDigit: '1',
    });
    // Status-0 grouping-only row from an intervening pendente round (no detalhe_a) — must be ignored as a reference.
    await ds.query(
      `INSERT INTO public.ordem_pagamento_agrupado_historico
         (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES (906, 604, '2026-08-01', '1', '1', '11111', '1', 0, NULL)`,
    );
    // Newest failure: matches current bank data exactly — must be the reference used.
    await ds.query(
      `INSERT INTO public.ordem_pagamento_agrupado_historico
         (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankCode", "userBankAgency", "userBankAccount", "userBankAccountDigit", "statusRemessa", "motivoStatusRemessa")
       VALUES (907, 604, '2026-09-01', '1', '1', '11111', '1', 4, 'AL')`,
    );
    await ds.query(
      `INSERT INTO public.detalhe_a (id, "ordemPagamentoAgrupadoHistoricoId", "dataVencimento", "valorLancamento", "valorRealEfetivado")
       VALUES (15, 907, '2026-09-01', 200.00, 200.00)`,
    );

    await ds.query(
      `CALL p_agrupar_ordens_guardador_pendente($1, $2, $3, $4)`,
      ['2026-09-01', '2026-09-10', '2026-09-16', 1],
    );

    expect(await wasRetried(604)).toBe(false);
  });

  it.each([
    ['AL', 'AI'],
    ['HO', 'RJ'],
  ])('BANK-7: applies the same unchanged/changed outcome regardless of motivo code (%s, %s)', async (motivoA, motivoB) => {
    await seedUser({ id: 8, bankCode: 1, bankAgency: '1', bankAccount: '11111', bankAccountDigit: '1' });
    await seedRealFailureLeafOpa({
      opaId: 605, opgId: 15, userId: 8, historicoId: 908, detalheAId: 16,
      dataReferencia: '2026-08-05', statusRemessa: 4, motivoStatusRemessa: motivoA,
      userBankCode: '1', userBankAgency: '1', userBankAccount: '11111', userBankAccountDigit: '1',
    });

    await seedUser({ id: 9, bankCode: 1, bankAgency: '1', bankAccount: '99999', bankAccountDigit: '1' });
    await seedRealFailureLeafOpa({
      opaId: 606, opgId: 16, userId: 9, historicoId: 909, detalheAId: 17,
      dataReferencia: '2026-08-05', statusRemessa: 4, motivoStatusRemessa: motivoB,
      userBankCode: '1', userBankAgency: '1', userBankAccount: '11111', userBankAccountDigit: '1',
    });

    await ds.query(
      `CALL p_agrupar_ordens_guardador_pendente($1, $2, $3, $4)`,
      ['2026-09-01', '2026-09-10', '2026-09-16', 1],
    );

    expect(await wasRetried(605)).toBe(false); // unchanged bank data, regardless of motivoA
    expect(await wasRetried(606)).toBe(true); // changed bank data, regardless of motivoB
  });
});
