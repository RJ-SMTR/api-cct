import { ESLint } from 'eslint';
import { resolve } from 'path';

jest.setTimeout(60000);

const ROOT = resolve(__dirname, '../..');
const eslint = new ESLint({ cwd: ROOT });

// lintText needs real files: the type-aware parser reads them from tsconfig.json.
// Rules are chosen by the role suffix of the linted file (`*.controller.ts`, ...).
const FILE = {
  controller: 'src/agentes/agentes.controller.ts',
  service: 'src/agentes/agentes.service.ts',
  repository: 'src/agentes/agentes.repository.ts',
  utils: 'src/utils/array-utils.ts',
};

async function boundaryMessages(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(ROOT, filePath) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message);
}

describe('layer boundaries (by file role)', () => {
  it('forbids a controller from importing a repository', async () => {
    const messages = await boundaryMessages(FILE.controller, "import { X } from 'src/users/users.repository';");

    expect(messages).toEqual(["'src/users/users.repository' import is restricted from being used by a pattern. Controllers must go through a service, not import a repository."]);
  });

  it.each([
    ["from './x.repository'"],
    ["from '../users/x.repository'"],
    ["from '../../src/users/x.repository'"],
  ])('catches relative and absolute repository imports in a controller (%s)', async (source) => {
    const messages = await boundaryMessages(FILE.controller, `import { X } ${source};`);

    expect(messages).toHaveLength(1);
  });

  it('forbids a service from importing a controller', async () => {
    const messages = await boundaryMessages(FILE.service, "import { X } from 'src/users/users.controller';");

    expect(messages).toEqual(["'src/users/users.controller' import is restricted from being used by a pattern. Services must not depend on controllers."]);
  });

  it('forbids a repository from importing a controller', async () => {
    const messages = await boundaryMessages(FILE.repository, "import { X } from 'src/users/users.controller';");

    expect(messages).toEqual(["'src/users/users.controller' import is restricted from being used by a pattern. Repositories must not depend on controllers."]);
  });

  it('forbids a repository from importing a service', async () => {
    const messages = await boundaryMessages(FILE.repository, "import { X } from 'src/users/users.service';");

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Repositories must not depend on services');
  });

  it.each(['controller', 'service', 'repository'])('forbids utils from importing a %s', async (role) => {
    const messages = await boundaryMessages(FILE.utils, `import { X } from 'src/users/users.${role}';`);

    expect(messages).toEqual([`'src/users/users.${role}' import is restricted from being used by a pattern. Utils are shared by every module and must not depend on controllers, services or repositories.`]);
  });

  it.each([
    ['controller', 'service'],
    ['controller', 'utils'],
    ['service', 'repository'],
    ['service', 'utils'],
    ['repository', 'utils'],
  ] as const)('allows %s to import %s', async (from, to) => {
    const source = to === 'utils' ? 'src/utils/array-utils' : `src/users/users.${to}`;
    const messages = await boundaryMessages(FILE[from], `import { X } from '${source}';`);

    expect(messages).toEqual([]);
  });

  it('does not apply to spec files', async () => {
    const messages = await boundaryMessages('src/agentes/agentes.service.spec.ts', "import { X } from 'src/users/users.controller';");

    expect(messages).toEqual([]);
  });

  it('does not confuse similarly named imports with roles', async () => {
    const messages = await boundaryMessages(FILE.controller, "import { A } from './repository-helper'; import { B } from 'src/users/repository-types';");

    expect(messages).toEqual([]);
  });
});
