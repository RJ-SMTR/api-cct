import { readFileSync } from 'fs';

/**
 * ssh2 < 1.16 importava `isDate` direto de `util`, função removida no Node 23+. Em Node novo o
 * `put` do SFTP (SftpService.submitCnabRemessa) quebrava com "isDate is not a function" na hora de
 * enviar a remessa ao banco. Estes testes impedem a volta de uma versão assim.
 */
describe('ssh2 - compatibilidade com Node sem util.isDate', () => {
  it('usa ssh2 >= 1.16.0', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { version } = require('ssh2/package.json');
    const [major, minor] = String(version).split('.').map(Number);
    expect(major > 1 || (major === 1 && minor >= 16)).toBe(true);
  });

  it('o SFTP.js do ssh2 não importa isDate diretamente de util', () => {
    const source = readFileSync(require.resolve('ssh2/lib/protocol/SFTP.js'), 'utf8');
    expect(source).not.toMatch(/const\s*\{[^}]*\bisDate\b[^}]*\}\s*=\s*require\(['"]util['"]\)/);
  });
});
