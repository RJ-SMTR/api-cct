import { compareEslint, compareSuites } from './ratchet';

describe('compareSuites', () => {
  it('has no violations when every baseline-passing suite still passes', () => {
    const violations = compareSuites(['src/a.spec.ts'], { 'src/a.spec.ts': 'passed' });

    expect(violations).toEqual([]);
  });

  it('reports a suite that passed in the baseline and now fails', () => {
    const violations = compareSuites(['src/a.spec.ts'], { 'src/a.spec.ts': 'failed' });

    expect(violations).toEqual([{ path: 'src/a.spec.ts', message: 'src/a.spec.ts passed in the baseline but is now failed' }]);
  });

  it('reports a baseline-passing suite that no longer exists', () => {
    const violations = compareSuites(['src/gone.spec.ts'], {});

    expect(violations).toEqual([{ path: 'src/gone.spec.ts', message: 'src/gone.spec.ts passed in the baseline but is now missing' }]);
  });

  it('ignores suites that were already broken in the baseline', () => {
    const violations = compareSuites(['src/a.spec.ts'], { 'src/a.spec.ts': 'passed', 'src/broken.spec.ts': 'failed' });

    expect(violations).toEqual([]);
  });
});

describe('compareEslint', () => {
  it('reports a file with more errors than the baseline', () => {
    const violations = compareEslint({ 'src/a.ts': 2 }, { 'src/a.ts': 3 });

    expect(violations).toEqual([{ path: 'src/a.ts', message: 'src/a.ts has 3 eslint errors, up from 2 in the baseline' }]);
  });

  it('reports a file that is not in the baseline and has errors', () => {
    const violations = compareEslint({}, { 'src/new.ts': 1 });

    expect(violations).toEqual([{ path: 'src/new.ts', message: 'src/new.ts has 1 eslint errors, up from 0 in the baseline' }]);
  });

  it('accepts files with the same or fewer errors than the baseline', () => {
    const violations = compareEslint({ 'src/a.ts': 2, 'src/b.ts': 5 }, { 'src/a.ts': 2, 'src/b.ts': 1 });

    expect(violations).toEqual([]);
  });

  it('accepts a baseline file that no longer has errors or no longer exists', () => {
    const violations = compareEslint({ 'src/gone.ts': 4 }, {});

    expect(violations).toEqual([]);
  });

  it('orders violations by path so the output is deterministic', () => {
    const violations = compareEslint({}, { 'src/z.ts': 1, 'src/a.ts': 1 });

    expect(violations.map((v) => v.path)).toEqual(['src/a.ts', 'src/z.ts']);
  });
});
