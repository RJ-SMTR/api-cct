import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Ids de usuário com acesso à área de Auditoria. Por padrão só o usuário 45; pode ser ampliado pela variável
 * de ambiente AUDITORIA_USER_IDS (lista separada por vírgula).
 */
export function usuariosComAcessoAuditoria(): number[] {
  const configurado = (process.env.AUDITORIA_USER_IDS ?? '45')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  return configurado.length > 0 ? configurado : [45];
}

/** Libera a rota só para os usuários da lista acima (usar depois do AuthGuard('jwt')). */
@Injectable()
export class AuditoriaAcessoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const usuarioId = Number(context.switchToHttp().getRequest()?.user?.id);
    if (!usuariosComAcessoAuditoria().includes(usuarioId)) {
      throw new ForbiddenException({ error: 'Acesso restrito à área de auditoria.' });
    }
    return true;
  }
}
