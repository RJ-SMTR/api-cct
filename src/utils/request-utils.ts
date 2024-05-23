import { IRequest } from './interfaces/request.interface';

export function getRequestLog(request: IRequest) {
  return `${request.method} ${request.protocol}://${request.get('Host')}${
    request.originalUrl
  }`;
}
