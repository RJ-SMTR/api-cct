import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RoleEnum } from 'src/roles/roles.enum';

/** Libera a rota só para a role Admin Master TI (usar depois do AuthGuard('jwt')). */
@Injectable()
export class AuditoriaAcessoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const roleId = Number(context.switchToHttp().getRequest()?.user?.role?.id);
    if (roleId !== RoleEnum.master_ti) {
      throw new ForbiddenException({ error: 'Acesso restrito à área de auditoria.' });
    }
    return true;
  }
}
