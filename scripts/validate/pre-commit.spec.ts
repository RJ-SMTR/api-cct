import { stagedTypeScriptFiles } from './pre-commit';

describe('stagedTypeScriptFiles', () => {
  it('keeps only .ts files', () => {
    expect(stagedTypeScriptFiles(['src/a.ts', 'README.md', 'package.json', 'src/b.spec.ts'])).toEqual(['src/a.ts', 'src/b.spec.ts']);
  });

  it('returns nothing when no TypeScript file is staged', () => {
    expect(stagedTypeScriptFiles(['docs/a.md', 'package.json'])).toEqual([]);
  });

  it('does not treat files that merely contain ".ts" as TypeScript', () => {
    expect(stagedTypeScriptFiles(['notes.ts.md', 'src/x.tsx'])).toEqual([]);
  });
});
