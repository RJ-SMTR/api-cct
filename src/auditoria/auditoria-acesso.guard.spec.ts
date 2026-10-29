import { ForbiddenException } from '@nestjs/common';
import { RoleEnum } from 'src/roles/roles.enum';
import { AuditoriaAcessoGuard } from './auditoria-acesso.guard';

describe('AuditoriaAcessoGuard', () => {
  const contexto = (user: any) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;

  it('libera só a role Admin Master TI', () => {
    const guard = new AuditoriaAcessoGuard();
    expect(guard.canActivate(contexto({ id: 1, role: { id: RoleEnum.master_ti } }))).toBe(true);
    expect(() => guard.canActivate(contexto({ id: 45, role: { id: RoleEnum.master } }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contexto(undefined))).toThrow(ForbiddenException);
  });
});
