import { RoleEnum } from './roles.enum';

export function getLoginRedirectTo(roleId?: number | null): string {
  return roleId === RoleEnum.agentes ? '/agentes/sign-in' : '/sign-in';
}
