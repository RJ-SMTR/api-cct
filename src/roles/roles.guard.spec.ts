import { RolesGuard } from './roles.guard';
import { RoleEnum } from './roles.enum';

describe('RolesGuard', () => {
  const contexto = (roleId?: number) =>
    ({ getClass: () => ({}), getHandler: () => ({}), switchToHttp: () => ({ getRequest: () => ({ user: { role: { id: roleId } } }) }) }) as any;
  const guardCom = (roles: number[]) => new RolesGuard({ getAllAndOverride: () => roles } as any);

  it('Admin Master TI acessa rota restrita a outra role', () => {
    expect(guardCom([RoleEnum.admin]).canActivate(contexto(RoleEnum.master_ti))).toBe(true);
  });

  it('mantém a regra para as demais roles', () => {
    expect(guardCom([RoleEnum.admin]).canActivate(contexto(RoleEnum.user))).toBe(false);
    expect(guardCom([RoleEnum.admin]).canActivate(contexto(RoleEnum.admin))).toBe(true);
    expect(guardCom([]).canActivate(contexto(RoleEnum.user))).toBe(true);
  });
});
