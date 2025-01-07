import { IRequest } from './interfaces/request.interface';
import { HttpException, HttpStatus } from '@nestjs/common';

export function getRequestLog(request: IRequest) {
  return `${request.method} ${request.protocol}://${request.get('Host')}${
    request.originalUrl
  }`;
}

export function canProceed(request: IRequest, userId: number | undefined) {
  if (request.user && request.user.role && request.user.role.name) {
    if (!isAdmin(request) && (request.user.id != userId)) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }
}

export function isAdmin(request: IRequest) {
  if (request.user && request.user.role && request.user.role.name) {
    return request.user.role.name.toUpperCase() === 'ADMIN';
  }
  return false;
}
