/**
 * Trigger that stamps "bankDataUpdatedAt" and "previousBankCode" on any write of the bank data,
 * including SQL run outside the API (e.g. bulk loads in pgAdmin, which left 150 guardadores
 * without the date on 2026-11-10).
 * Run with RUN_RETORNO_DB_TESTS=1 against a disposable LOCAL database only (localhost:5432).
 * Everything runs in a throwaway schema that is dropped at the end.
 */
import { Client } from 'pg';
import { QueryRunner } from 'typeorm';
import { StampBankDataChangesTrigger1792200000000 } from './migrations/1792200000000-StampBankDataChangesTrigger';

const RUN = !!process.env.RUN_RETORNO_DB_TESTS;
const suite = RUN ? describe : describe.skip;
const SCHEMA = 'bank_data_trigger_spec';
const OLD_DATE = '2026-01-01 00:00:00';
const APP_DATE = '2026-11-16 12:00:00';

suite('bank data trigger (integration, local Postgres)', () => {
  let client: Client;

  const q = async (sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows;
  const insertUser = async (bank: { bankCode?: number | null; bankAgency?: string | null } = {}) => {
    const [row] = await q(
      `INSERT INTO "user" ("fullName", "bankCode", "bankAgency", "bankAccount", "bankAccountDigit")
       VALUES ('TESTE', $1, $2, $3, $4) RETURNING id`,
      bank.bankCode === undefined ? [341, '0842', '11758', '6'] : [bank.bankCode, bank.bankAgency ?? null, null, null],
    );
    return row.id as number;
  };
  const bankState = async (id: number) => {
    const [row] = await q(
      `SELECT "previousBankCode", "bankDataUpdatedAt" IS NOT NULL AS stamped,
              to_char("bankDataUpdatedAt", 'YYYY-MM-DD HH24:MI:SS') AS date
       FROM "user" WHERE id = $1`,
      [id],
    );
    return row;
  };

  beforeAll(async () => {
    client = new Client({
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: Number(process.env.DATABASE_PORT ?? 5432),
      user: process.env.DATABASE_USERNAME ?? 'postgres',
      password: process.env.DATABASE_PASSWORD ?? 'test',
      database: process.env.DATABASE_NAME ?? 'api_teste',
    });
    if (!['localhost', '127.0.0.1'].includes(client.host) || client.port !== 5432) {
      throw new Error('refusing to run outside localhost:5432');
    }
    await client.connect();
    await q(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await q(`CREATE SCHEMA ${SCHEMA}`);
    await q(`SET search_path TO ${SCHEMA}`);
    await q(`
      CREATE TABLE "user" (
        id serial PRIMARY KEY,
        "fullName" varchar,
        "bankCode" integer,
        "bankAgency" varchar,
        "bankAccount" varchar,
        "bankAccountDigit" varchar,
        "previousBankCode" integer,
        "bankDataUpdatedAt" timestamp
      )`);
    const runner = { query: (sql: string) => q(sql) } as unknown as QueryRunner;
    await new StampBankDataChangesTrigger1792200000000().up(runner);
  });

  afterAll(async () => {
    await q(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.end();
  });

  it('stamps the date when a user is created with bank data, without a previous bank', async () => {
    const id = await insertUser();
    expect(await bankState(id)).toMatchObject({ stamped: true, previousBankCode: null });
  });

  it('leaves the date empty when a user is created without bank data', async () => {
    const id = await insertUser({ bankCode: null });
    expect(await bankState(id)).toMatchObject({ stamped: false, previousBankCode: null });
  });

  // [case, SET clause, starting bankCode, starting bankAgency, date restamped?, expected previousBankCode]
  it.each([
    ['first fill (no bank before)', `"bankCode" = 341, "bankAgency" = '0842'`, null, null, true, null],
    ['bank code changed', `"bankCode" = 104`, 341, '0842', true, 341],
    ['agency changed, same bank', `"bankAgency" = '9999'`, 341, '0842', true, null],
    ['blank agency written as NULL', `"bankAgency" = NULL`, 341, ' ', false, null],
    ['only the name changed', `"fullName" = 'OUTRO'`, 341, '0842', false, null],
    ['same bank data rewritten', `"bankCode" = 341, "bankAgency" = '0842'`, 341, '0842', false, null],
  ])('direct UPDATE: %s', async (_name, set, startBank, startAgency, expectStamped, expectPrevious) => {
    const id = await insertUser({ bankCode: startBank as number | null, bankAgency: startAgency as string | null });
    await q(`UPDATE "user" SET "bankDataUpdatedAt" = $1 WHERE id = $2`, [OLD_DATE, id]);

    await q(`UPDATE "user" SET ${set} WHERE id = $1`, [id]);

    const state = await bankState(id);
    expect(state.previousBankCode).toBe(expectPrevious);
    expect(state.date !== OLD_DATE).toBe(expectStamped);
  });

  it('keeps the date and previous bank the API wrote itself', async () => {
    const id = await insertUser();
    await q(`UPDATE "user" SET "bankCode" = 104, "previousBankCode" = 341, "bankDataUpdatedAt" = $1 WHERE id = $2`, [APP_DATE, id]);
    expect(await bankState(id)).toMatchObject({ date: APP_DATE, previousBankCode: 341 });
  });
});
