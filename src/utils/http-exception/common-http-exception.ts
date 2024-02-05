import { HttpException, HttpStatus } from '@nestjs/common';

export const CommonHttpException = {
  simpleDetail: (
    field: string,
    message: string,
    httpStatusCode: HttpStatus = 500,
  ) =>
    new HttpException(
      {
        details: {
          [field]: message,
        },
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
