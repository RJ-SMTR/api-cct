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
  message: (errorMessage: string, httpStatusCode?: HttpStatus) =>
    new HttpException(
      {
        error: {
          message: errorMessage,
        },
      },
      httpStatusCode || HttpStatus.INTERNAL_SERVER_ERROR,
    ),
  invalidField: (
    entity: string,
    fieldName: string,
    args?: {
      errorMessage?: string;
      httpStatusCode?: HttpStatus;
    },
  ) =>
    new HttpException(
      {
        error: {
          message: `${entity} tem o campo '${fieldName}' vazio`,
          user: {
            [fieldName]: args?.errorMessage || 'Campo vazio',
          },
        },
      },
      args?.httpStatusCode || HttpStatus.UNPROCESSABLE_ENTITY,
    ),
  errorDetails: (
    error: string,
    details: object | string,
    httpStatusCode: HttpStatus = 500,
  ) =>
    new HttpException(
      {
        error: error || getHttpStatusMessage(httpStatusCode),
        details: typeof details === 'string' ? { message: details } : details,
      },
      httpStatusCode,
    ),
  details: (details: object | string, httpStatusCode: HttpStatus = 500) =>
    new HttpException(
      {
        error: getHttpStatusMessage(httpStatusCode),
        details: typeof details === 'string' ? { message: details } : details,
      },
      httpStatusCode,
    ),
  invalidRequestParams: (invalidParams?: any, errorMessage?: string) =>
    new HttpException(
      {
        error: errorMessage || 'Parâmetros inválidos da requisição',
        ...(invalidParams ? { params: invalidParams } : {}),
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    ),
  notFound: (
    notFoundProp: string,
    httpStatusCode: HttpStatus = HttpStatus.NOT_FOUND,
    error?: string,
  ) =>
    new HttpException(
      {
        error: error || getHttpStatusMessage(httpStatusCode),
        ...(notFoundProp
          ? {
              details: {
                [notFoundProp]: 'not found',
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
