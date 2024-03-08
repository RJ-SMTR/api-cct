import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { HttpException, HttpStatus, Injectable, Type } from '@nestjs/common';
import { HttpStatusMessage } from '../enums/http-error-message.enum';

@Injectable()
export class BaseValidator {
  async validateOrReject<T>(
    inputs: Record<string, any>,
    schemaMeta: Type<T>,
    httpStatus: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    httpErrorMessage:
      | HttpStatusMessage
      | undefined = HttpStatusMessage.UNPROCESSABLE_ENTITY,
  ): Promise<T> {
    const schema: T = plainToClass(schemaMeta, inputs);
    const errors = await validate(schema as Record<string, any>, {
      stopAtFirstError: true,
    });

    if (errors.length > 0) {
      const error = errors[0];
      const constraints = error.constraints;
      if (constraints !== undefined) {
        throw new HttpException(
          {
            ...(httpErrorMessage && { error: httpErrorMessage }),
            details: {
              [error.property]: constraints[Object.keys(constraints)[0]],
            },
          },
          httpStatus,
        );
      }
    }

    return schema;
  }
}
