import * as fs from 'fs';
import * as path from 'path';
import { buildConsorcioCaseSql, CONSORCIOS, INSTITUTIONAL_CPF_CNPJ, MODAIS } from './consorcio-resolver';

describe('consorcio-resolver', () => {
  // Texto copiado literalmente de consorcioCaseSimples/MODAIS/CONSORCIOS
  // (relatorio-novo-remessa-consolidado.repository.ts), fonte de verdade independente desta
  // implementacao — nao gerado pelo codigo sob teste.
  const EXPECTED_CASE = `CASE
    WHEN pu."permitCode" = '8' THEN 'VLT'
    WHEN pu."permitCode" LIKE '4%' THEN 'STPC'
    WHEN pu."permitCode" LIKE '81%' THEN 'STPL'
    WHEN pu."permitCode" LIKE '7%' THEN 'TEC'
    ELSE op."nomeConsorcio"
  END`;

  const EXPECTED_MODAIS = ['STPC', 'STPL', 'TEC'];
  const EXPECTED_CONSORCIOS = [
    'VLT',
    'Intersul',
    'Transcarioca',
    'Internorte',
    'MobiRio',
    'Santa Cruz',
    'MOBI-Rio BUM',
    'TUSE',
    'STPC',
    'STPL',
    'TEC',
    'GTU',
  ];

  const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim();

  it('produces the same CASE as consorcioCaseSimples for aliases pu/op', () => {
    expect(normalize(buildConsorcioCaseSql('pu', 'op'))).toBe(normalize(EXPECTED_CASE));
  });

  it('MODAIS matches the private array in relatorio-novo-remessa-consolidado.repository.ts', () => {
    expect(MODAIS).toEqual(EXPECTED_MODAIS);
  });

  it('CONSORCIOS matches the private array in relatorio-novo-remessa-consolidado.repository.ts', () => {
    expect(CONSORCIOS).toEqual(EXPECTED_CONSORCIOS);
  });

  // Texto copiado literalmente de NOT_CPF_FILTER (novo-remessa-query-builder.ts).
  it('INSTITUTIONAL_CPF_CNPJ matches the legacy NOT_CPF_FILTER list', () => {
    expect(INSTITUTIONAL_CPF_CNPJ).toEqual([
      '18201378000119',
      '12464869000176',
      '12464539000180',
      '12464553000184',
      '44520687000161',
      '12464577000133',
    ]);
  });

  // CronJobsService.CONSORCIOS ("puro") e o CONSORCIOS do Consolidado ("com modais") nao sao a
  // mesma lista por desenho (CONTEXT.md, 2026-11-09) - nao e bug, nenhum lado muda.
  describe('anti-divergencia: CronJobsService tem suas proprias copias de MODAIS/CONSORCIOS', () => {
    const cronJobsSource = fs.readFileSync(
      path.resolve(__dirname, '../../../cron-jobs/cron-jobs.service.ts'),
      'utf-8',
    );

    function extractArrayLiteral(source: string, constName: string): string[] {
      const match = source.match(new RegExp(`${constName}\\s*=\\s*\\[([^\\]]*)\\]`));
      if (!match) {
        throw new Error(`Nao encontrei o literal ${constName} em cron-jobs.service.ts`);
      }
      return match[1]
        .split(',')
        .map((item) => item.trim().replace(/^'|'$/g, ''))
        .filter((item) => item.length > 0);
    }

    it('CronJobsService.MODAIS e identico ao MODAIS compartilhado', () => {
      const cronJobsModais = extractArrayLiteral(cronJobsSource, 'MODAIS');
      expect(cronJobsModais).toEqual(MODAIS);
    });

    // CronJobsService.CONSORCIOS e so consorcio comum, sem modal; o CONSORCIOS do Consolidado
    // (alvo de paridade deste modulo) ja inclui STPC/STPL/TEC dentro do proprio array - nao sao
    // a mesma lista por desenho (CONTEXT.md, "Consorcio" e "Decisoes", 2026-11-09). A comparacao
    // correta e CronJobsService.CONSORCIOS + CronJobsService.MODAIS (o equivalente a
    // "consorciosEModais" que o proprio CronJobsService monta) contra o CONSORCIOS exportado
    // aqui, nunca os dois arrays CONSORCIOS crus entre si.
    it('CronJobsService.CONSORCIOS + CronJobsService.MODAIS (consorciosEModais) tem o mesmo conjunto do CONSORCIOS compartilhado', () => {
      const cronJobsConsorcios = extractArrayLiteral(cronJobsSource, 'CONSORCIOS');
      const cronJobsModais = extractArrayLiteral(cronJobsSource, 'MODAIS');
      const consorciosEModais = [...cronJobsConsorcios, ...cronJobsModais];
      // Mesmo conjunto, ordem nao importa (CronJobsService lista GTU antes de STPC/STPL/TEC;
      // o CONSORCIOS do Consolidado lista GTU depois - ordens diferentes, mesma lista logica).
      expect([...consorciosEModais].sort()).toEqual([...CONSORCIOS].sort());
    });
  });
});
