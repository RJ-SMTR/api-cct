import { HttpExceptionOptions } from '@nestjs/common/exceptions/http.exception';

export type HttpExceptionArgs = [
  response: string | Record<string, any>,
  status: number,
  options?: HttpExceptionOptions,
];
