import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { parseJestJson } from './collect';
import { compareSuites } from './ratchet';

const ROOT = resolve(__dirname, '../..');
const bin = (name: string) => join(ROOT, 'node_modules', '.bin', name);

export function stagedTypeScriptFiles(files: string[]): string[] {
  return files.filter((file) => file.endsWith('.ts'));
}

function stagedFiles(): string[] {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8' });
  return result.stdout.split('\n').filter(Boolean);
}

function fail(lines: string[]): number {
  console.error('\npre-commit: blocked');
  lines.forEach((line) => console.error(`  - ${line}`));
  console.error('Emergency bypass: git commit --no-verify. If you do, record why in docs/TECH-DEBT.md.');
  return 1;
}

function main(): number {
  const files = stagedTypeScriptFiles(stagedFiles());
  if (files.length === 0) {
    return 0;
  }

  console.log('pre-commit: build check...');
  const build = spawnSync(bin('tsc'), ['--noEmit', '-p', 'tsconfig.build.json'], { cwd: ROOT, encoding: 'utf8' });
  if (build.status !== 0) {
    return fail([`Build failed (tsc -p tsconfig.build.json):\n${build.stdout}${build.stderr}`.trim()]);
  }

  console.log('pre-commit: related specs...');
  const dir = mkdtempSync(join(tmpdir(), 'pre-commit-'));
  const outputFile = join(dir, 'jest.json');
  try {
    spawnSync(bin('jest'), ['--findRelatedTests', ...files, '--passWithNoTests', '--json', `--outputFile=${outputFile}`], { cwd: ROOT, encoding: 'utf8' });
    if (!existsSync(outputFile)) {
      return 0;
    }
    const current = parseJestJson(JSON.parse(readFileSync(outputFile, 'utf8')), ROOT);
    const baseline = JSON.parse(readFileSync(join(__dirname, 'baseline.json'), 'utf8'));
    const relevant = baseline.passingSuites.filter((suite: string) => suite in current);
    const violations = compareSuites(relevant, current);
    return violations.length === 0 ? 0 : fail(violations.map((v) => v.message));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  process.exit(main());
}
