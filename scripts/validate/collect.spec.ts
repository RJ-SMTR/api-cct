import { parseEslintJson, parseJestJson } from './collect';

describe('parseJestJson', () => {
  it('maps suites to repo-relative paths and normalized statuses', () => {
    const result = parseJestJson(
      {
        testResults: [
          { name: '/repo/src/a.spec.ts', status: 'passed' },
          { name: '/repo/src/b.spec.ts', status: 'failed' },
          { name: '/repo/src/c.spec.ts', status: 'skipped' },
          { name: '/repo/src/d.spec.ts', status: 'pending' },
          { name: '/repo/src/e.spec.ts', status: 'focused' },
        ],
      },
      '/repo',
    );

    expect(result).toEqual({
      'src/a.spec.ts': 'passed',
      'src/b.spec.ts': 'failed',
      'src/c.spec.ts': 'skipped',
      'src/d.spec.ts': 'skipped',
      'src/e.spec.ts': 'passed',
    });
  });

  it('treats an unknown status as failed', () => {
    expect(parseJestJson({ testResults: [{ name: '/repo/src/a.spec.ts', status: 'weird' }] }, '/repo')).toEqual({ 'src/a.spec.ts': 'failed' });
  });

  it('throws when the jest output has no testResults', () => {
    expect(() => parseJestJson({}, '/repo')).toThrow('jest output has no testResults');
  });
});

describe('parseEslintJson', () => {
  it('keeps only files with errors, using repo-relative paths', () => {
    const result = parseEslintJson(
      [
        { filePath: '/repo/src/a.ts', errorCount: 2, warningCount: 5 },
        { filePath: '/repo/src/clean.ts', errorCount: 0, warningCount: 1 },
        { filePath: '/repo/test/b.ts', errorCount: 1, warningCount: 0 },
      ],
      '/repo',
    );

    expect(result).toEqual({ 'src/a.ts': 2, 'test/b.ts': 1 });
  });

  it('throws when the eslint output is not a list', () => {
    expect(() => parseEslintJson({}, '/repo')).toThrow('eslint output is not a list');
  });
});
