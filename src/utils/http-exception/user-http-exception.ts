import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions';

export const UserHttpException = {
  invalidField: (
    fieldName: string,
    args?: {
      errorMessage?: string;
      httpStatusCode?: HttpStatus;
    },
  ) =>
    new HttpException(
      {
        error: {
          message: `Usuário tem o campo '${fieldName}' vazio`,
          user: {
            [fieldName]: args?.errorMessage || 'Campo vazio',
          },
        },
      },
      args?.httpStatusCode || HttpStatus.UNPROCESSABLE_ENTITY,
    ),
};
