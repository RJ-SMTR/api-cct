import { HttpException, HttpStatus } from '@nestjs/common';
import { getHttpStatusMessage } from './http-exception-utils';

export const CommonHttpException = {
  detailField: (
    field: string,
    message: string,
    httpStatusCode: HttpStatus = 500,
  ) =>
    new HttpException(
      {
        error: getHttpStatusMessage(httpStatusCode),
        details: {
          [field]: message,
        },
      },
      httpStatusCode,
    ),
  errorDetails: (
    error: string,
    details: object,
    httpStatusCode: HttpStatus = 500,
  ) =>
    new HttpException(
      {
        error: getHttpStatusMessage(httpStatusCode),
        details,
      },
      httpStatusCode,
    ),
  simpleDetails: (details: any, httpStatusCode: HttpStatus = 500) =>
    new HttpException(
      {
        error: getHttpStatusMessage(httpStatusCode),
        details,
      },
      httpStatusCode,
    ),
  notFound: (
    notFoundItem: string,
    httpStatusCode: HttpStatus = HttpStatus.NOT_FOUND,
    error?: string,
  ) =>
    new HttpException(
      {
        error: error || getHttpStatusMessage(httpStatusCode),
        ...(notFoundItem
          ? {
              details: {
                [notFoundItem]: 'not found',
              },
            }
          : {}),
      },
      httpStatusCode,
    ),
  argNotType: (
    field: string,
    expectedType: string,
    value: any,
    httpStatusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    detailsOnly = true,
  ) =>
    new HttpException(
      {
        code: 'arg-not-type',
        ...(detailsOnly
          ? {}
          : {
              error: `O campo ${field} deveria ser um ${expectedType} mas recebeu '${value}'`,
            }),
        details: {
          [field]: `O campo ${field} deveria ser um ${expectedType} mas recebeu '${value}'`,
        },
      },
      httpStatusCode,
    ),
};
