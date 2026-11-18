/**
 * Ordem alfabetica dos relatorios no Postgres igual a do Consolidado (localeCompare 'pt-BR'):
 * espaco conta (ANA CRISTINA antes de ANACLETO), acento e caixa nao jogam o nome para o fim.
 * Run with RUN_RETORNO_DB_TESTS=1 against a local database (DATABASE_* env vars).
 */
import { Client } from 'pg';
import { chaveOrdemAlfabeticaSql } from './ordem-alfabetica-sql';

const RUN = Boolean(process.env.RUN_RETORNO_DB_TESTS);
const suite = RUN ? describe : describe.skip;

suite('chaveOrdemAlfabeticaSql (PostgreSQL)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it('ordena os nomes como o Consolidado (pt-BR), com o espaco contando', async () => {
    const nomes = ['ANACLETO', 'ANA CRISTINA', 'ALEXSANDRE MACHADO', 'ALEX SANDRO', 'ÁLVARO', 'ALVARO BRAGA', 'Josemiro Antonio', 'JOSÉ NAZARENO', 'ZULMIRA', 'ÉRICA', 'EDUARDO', null];
    const valores = nomes.map((_, i) => `($${i + 1}::text)`).join(', ');

    const { rows } = await client.query(`SELECT nome FROM (VALUES ${valores}) AS t(nome) ORDER BY ${chaveOrdemAlfabeticaSql('nome')}`, nomes);

    const esperado = [...nomes].sort((a, b) => (a ?? '').localeCompare(b ?? '', 'pt-BR', { sensitivity: 'base' }));
    expect(rows.map((row) => row.nome)).toEqual(esperado);
  });
});
