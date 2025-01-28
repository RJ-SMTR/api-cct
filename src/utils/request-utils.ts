import { IRequest } from './interfaces/request.interface';
import { HttpException, HttpStatus } from '@nestjs/common';

export function getRequestLog(request: IRequest) {
  return `${request.method} ${request.protocol}://${request.get('Host')}${
    request.originalUrl
  }`;
}

export function canProceed(request: IRequest, userId: number | undefined) {
  if (request.user && request.user.role && request.user.role.name) {
    if (isUser(request) && (request.user.id != userId)) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }
}

export function isUser(request: IRequest) {
  if (request.user && request.user.role && request.user.role.name) {
    return request.user.role.name.toUpperCase().startsWith('USER');
  }
  return false;
}
