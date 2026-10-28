import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleEnum } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<number[]>('roles', [
      context.getClass(),
      context.getHandler(),
    ]);
    const request = context.switchToHttp().getRequest();
    // Admin Master TI acessa qualquer rota protegida por role
    if (request.user?.role?.id === RoleEnum.master_ti) {
      return true;
    }
    if (!roles?.length) {
      return true;
    }

    return roles.includes(request.user?.role?.id);
  }
}
