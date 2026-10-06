import { SuiteStatus } from './ratchet';

const STATUS_MAP: Record<string, SuiteStatus> = {
  passed: 'passed',
  focused: 'passed',
  failed: 'failed',
  skipped: 'skipped',
  pending: 'skipped',
};

function relativeTo(rootDir: string, absolutePath: string): string {
  const normalize = (p: string) => p.replace(/\\/g, '/');
  const root = normalize(rootDir).replace(/\/?$/, '/');
  const target = normalize(absolutePath);
  return target.startsWith(root) ? target.slice(root.length) : target;
}

export function parseJestJson(output: any, rootDir: string): Record<string, SuiteStatus> {
  if (!Array.isArray(output?.testResults)) {
    throw new Error('jest output has no testResults');
  }
  const suites: Record<string, SuiteStatus> = {};
  for (const result of output.testResults) {
    suites[relativeTo(rootDir, result.name)] = STATUS_MAP[result.status] ?? 'failed';
  }
  return suites;
}

export function parseEslintJson(output: any, rootDir: string): Record<string, number> {
  if (!Array.isArray(output)) {
    throw new Error('eslint output is not a list');
  }
  const errors: Record<string, number> = {};
  for (const file of output) {
    if (file.errorCount > 0) {
      errors[relativeTo(rootDir, file.filePath)] = file.errorCount;
    }
  }
  return errors;
}
