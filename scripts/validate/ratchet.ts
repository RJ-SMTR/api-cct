export type SuiteStatus = 'passed' | 'failed' | 'skipped';

export interface Violation {
  path: string;
  message: string;
}

function sortByPath(violations: Violation[]): Violation[] {
  return violations.sort((a, b) => a.path.localeCompare(b.path));
}

export function compareSuites(baselinePassing: string[], current: Record<string, SuiteStatus>): Violation[] {
  const violations: Violation[] = [];
  for (const suite of baselinePassing) {
    const status = current[suite] ?? 'missing';
    if (status !== 'passed') {
      violations.push({ path: suite, message: `${suite} passed in the baseline but is now ${status}` });
    }
  }
  return sortByPath(violations);
}

export function compareEslint(baseline: Record<string, number>, current: Record<string, number>): Violation[] {
  const violations: Violation[] = [];
  for (const [file, errors] of Object.entries(current)) {
    const allowed = baseline[file] ?? 0;
    if (errors > allowed) {
      violations.push({ path: file, message: `${file} has ${errors} eslint errors, up from ${allowed} in the baseline` });
    }
  }
  return sortByPath(violations);
}
