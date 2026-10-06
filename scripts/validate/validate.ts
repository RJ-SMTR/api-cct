import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { parseEslintJson, parseJestJson } from './collect';
import { compareEslint, compareSuites, SuiteStatus, Violation } from './ratchet';

const ROOT = resolve(__dirname, '../..');
const BASELINE_PATH = join(__dirname, 'baseline.json');
const ESLINT_TARGETS = '{src,test,scripts}/**/*.ts';
const WIN = process.platform === 'win32';
const bin = (name: string) => join(ROOT, 'node_modules', '.bin', WIN ? `${name}.cmd` : name);

interface Baseline {
  generatedAt: string;
  node: string;
  passingSuites: string[];
  eslintErrors: Record<string, number>;
}

function runToJson(command: string, args: (outputFile: string) => string[]): any {
  const dir = mkdtempSync(join(tmpdir(), 'validate-'));
  const outputFile = join(dir, 'out.json');
  try {
    const result = spawnSync(command, args(outputFile), { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: WIN });
    if (!existsSync(outputFile)) {
      throw new Error(`${command} did not produce a JSON report.\n${result.stderr}`);
    }
    return JSON.parse(readFileSync(outputFile, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function collectSuites(): Record<string, SuiteStatus> {
  console.log('Running jest...');
  const report = runToJson(bin('jest'), (out) => ['--json', `--outputFile=${out}`]);
  // Print why each failing suite failed, so CI logs show more than the status.
  for (const suite of report.testResults ?? []) {
    if (suite.status !== 'failed') continue;
    const messages = [suite.message, ...(suite.assertionResults ?? []).flatMap((a: any) => a.failureMessages ?? [])].filter(Boolean);
    console.log(`\n--- FAILED ${suite.name}\n${messages.join('\n').slice(0, 4000)}`);
  }
  return parseJestJson(report, ROOT);
}

function collectEslint(): Record<string, number> {
  console.log('Running eslint (no --fix)...');
  return parseEslintJson(runToJson(bin('eslint'), (out) => [ESLINT_TARGETS, '--format', 'json', '--output-file', out]), ROOT);
}

function buildErrors(): string | null {
  console.log('Running tsc build check...');
  const result = spawnSync(bin('tsc'), ['--noEmit', '-p', 'tsconfig.build.json'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? null : `${result.stdout}${result.stderr}`.trim();
}

function updateBaseline(): void {
  const suites = collectSuites();
  const baseline: Baseline = {
    generatedAt: new Date().toISOString().slice(0, 10),
    node: process.version,
    passingSuites: Object.keys(suites).filter((s) => suites[s] === 'passed').sort(),
    eslintErrors: Object.fromEntries(Object.entries(collectEslint()).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline written to scripts/validate/baseline.json (${baseline.passingSuites.length} passing suites).`);
  console.log('If this relaxes anything, record why in docs/TECH-DEBT.md (skill: tech-debt).');
}

function validate(): number {
  if (!existsSync(BASELINE_PATH)) {
    console.error('scripts/validate/baseline.json not found. Run: npm run validate:update-baseline');
    return 1;
  }
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const problems: string[] = [];

  const build = buildErrors();
  if (build) {
    problems.push(`Build (tsc -p tsconfig.build.json) failed:\n${build}`);
  }
  const violations: Violation[] = [...compareSuites(baseline.passingSuites, collectSuites()), ...compareEslint(baseline.eslintErrors, collectEslint())];
  problems.push(...violations.map((v) => v.message));

  if (problems.length === 0) {
    console.log('validate: OK (nothing got worse than the baseline).');
    return 0;
  }
  console.error(`\nvalidate: FAILED (${problems.length} problem${problems.length === 1 ? '' : 's'})`);
  problems.forEach((p) => console.error(`  - ${p}`));
  return 1;
}

process.exit(process.argv.includes('--update-baseline') ? (updateBaseline(), 0) : validate());
