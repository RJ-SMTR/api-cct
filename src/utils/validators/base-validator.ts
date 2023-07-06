import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { HttpException, HttpStatus, Injectable, Type } from '@nestjs/common';

@Injectable()
export class BaseValidator {
  async validateOrReject<T>(
    inputs: Record<string, any>,
    schemaMeta: Type<T>,
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
            status: HttpStatus.UNPROCESSABLE_ENTITY,
            errors: {
              [error.property]: constraints[Object.keys(constraints)[0]],
            },
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    return schema;
  }
}
