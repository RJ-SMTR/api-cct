import { ForbiddenException } from '@nestjs/common';
import { AuditoriaAcessoGuard, usuariosComAcessoAuditoria } from './auditoria-acesso.guard';

describe('AuditoriaAcessoGuard', () => {
  const contexto = (user: any) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;
  const original = process.env.AUDITORIA_USER_IDS;
  afterEach(() => {
    if (original === undefined) delete process.env.AUDITORIA_USER_IDS;
    else process.env.AUDITORIA_USER_IDS = original;
  });

  it('libera só o usuário 45 por padrão', () => {
    delete process.env.AUDITORIA_USER_IDS;
    const guard = new AuditoriaAcessoGuard();
    expect(guard.canActivate(contexto({ id: 45 }))).toBe(true);
    expect(() => guard.canActivate(contexto({ id: 46 }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contexto(undefined))).toThrow(ForbiddenException);
  });

  it('aceita lista configurada e ignora valores inválidos', () => {
    process.env.AUDITORIA_USER_IDS = '45, 7,abc,-1';
    expect(usuariosComAcessoAuditoria()).toEqual([45, 7]);
    process.env.AUDITORIA_USER_IDS = 'xx';
    expect(usuariosComAcessoAuditoria()).toEqual([45]);
  });
});
